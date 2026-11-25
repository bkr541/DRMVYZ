-- Browser casting extends stage links without exposing signaling tables or token hashes.
begin;
create table public.web_cast_sessions (
  link_id uuid primary key references public.performance_stage_links(id) on delete cascade,
  code_hash bytea unique not null,
  host_seen timestamptz not null default now(),
  receiver_id uuid,
  receiver_hash bytea,
  receiver_seen timestamptz,
  approved boolean not null default false,
  offer jsonb,
  answer jsonb
);
alter table public.web_cast_sessions enable row level security;
revoke all on public.web_cast_sessions from public, anon, authenticated;
create table public.web_cast_join_limits (
  bucket text primary key, started_at timestamptz not null, hits integer not null
);
alter table public.web_cast_join_limits enable row level security;
revoke all on public.web_cast_join_limits from public, anon, authenticated;

-- Only the Edge Function can invoke this RPC. Host identity is verified there with auth.getUser.
-- Row locks serialize pairing, approval, signaling and revocation. No SDP is exposed before approval.
create function public.web_cast_command(p_action text, p_owner uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l public.performance_stage_links%rowtype;
  s public.web_cast_sessions%rowtype;
  v_code text; v_token text; v_entropy bytea; v_i integer;
  v_key text := p_payload->>'receiverKey';
  v_id uuid; v_receiver uuid; v_hits integer;
  v_bucket text := p_payload->>'bucket';
  v_sdp jsonb := p_payload->'description';
  v_host boolean := p_action in ('hostPoll','approve','reject','offer','stop');
  v_now timestamptz := clock_timestamp();
begin
  if p_action = 'create' then
    if p_owner is null or not exists(select 1 from auth.users u where u.id=p_owner and not coalesce(u.is_anonymous,false)) then
      return jsonb_build_object('error','Sign in required','status',401);
    end if;
    -- Serialize code allocation and cleanup; host creation is infrequent.
    perform pg_advisory_xact_lock(613061);
    update public.performance_stage_links x set revoked_at=v_now from public.web_cast_sessions w where w.link_id=x.id and x.revoked_at is null and (x.expires_at<=v_now or w.host_seen < v_now-interval '90 seconds');
    delete from public.web_cast_sessions w using public.performance_stage_links x
      where w.link_id=x.id and (x.revoked_at is not null or x.expires_at <= v_now or w.host_seen < v_now - interval '90 seconds');
    if exists(select 1 from public.web_cast_sessions w join public.performance_stage_links x on x.id=w.link_id where x.owner_user_id=p_owner) then
      return jsonb_build_object('error','A cast is already active. Stop it or wait 90 seconds.','status',409);
    end if;
    loop
      v_entropy := sha256(convert_to(gen_random_uuid()::text,'UTF8'));
      v_code := '';
      for v_i in 0..5 loop
        v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(v_entropy,v_i) % 32)+1, 1);
      end loop;
      exit when not exists(select 1 from public.web_cast_sessions w where w.code_hash=sha256(convert_to(v_code,'UTF8')));
    end loop;
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
    insert into public.performance_stage_links(owner_user_id,label,token_hash,expires_at)
      values(p_owner,'STAGELESS Cast',sha256(convert_to(v_token,'UTF8')),v_now+interval '8 hours') returning * into l;
    insert into public.web_cast_sessions(link_id,code_hash,host_seen) values(l.id,sha256(convert_to(v_code,'UTF8')),v_now);
    return jsonb_build_object('id',l.id,'code',v_code,'token',v_token,'expiresAt',l.expires_at);
  end if;
  if p_action='join' then
    -- Durable per-address limit across Edge isolates. Never store the address itself.
    if v_bucket is null or length(v_bucket)<>64 then return jsonb_build_object('error','Invalid request','status',400); end if;
    delete from public.web_cast_join_limits where started_at < v_now-interval '10 minutes';
    insert into public.web_cast_join_limits(bucket,started_at,hits) values(v_bucket,v_now,1)
      on conflict(bucket) do update set hits=case when web_cast_join_limits.started_at < v_now-interval '1 minute' then 1 else web_cast_join_limits.hits+1 end,
      started_at=case when web_cast_join_limits.started_at < v_now-interval '1 minute' then v_now else web_cast_join_limits.started_at end returning hits into v_hits;
    if v_hits>12 then return jsonb_build_object('error','Too many join attempts. Try again in a minute.','status',429); end if;
    select w.link_id into v_id from public.web_cast_sessions w join public.performance_stage_links x on x.id=w.link_id
      where (w.code_hash=sha256(convert_to(p_payload->>'code','UTF8')) or x.token_hash=sha256(convert_to(p_payload->>'token','UTF8')))
      and x.revoked_at is null and x.expires_at>v_now and w.host_seen>v_now-interval '90 seconds';
  else
    v_id := (p_payload->>'id')::uuid;
  end if;
  -- Always lock the parent first, so stop/revoke cannot race a signaling write.
  select * into l from public.performance_stage_links x where x.id=v_id for update;
  if not found or l.revoked_at is not null or l.expires_at<=v_now then return jsonb_build_object('error','Cast ended or not found','status',404); end if;
  select * into s from public.web_cast_sessions w where w.link_id=v_id for update;
  if not found or s.host_seen < v_now-interval '90 seconds' then return jsonb_build_object('error','Cast ended or not found','status',404); end if;
  if v_host then
    if p_owner is distinct from l.owner_user_id then return jsonb_build_object('error','Cast ended or not found','status',404); end if;
    s.host_seen:=v_now;
  end if;
  if s.receiver_seen < v_now-interval '45 seconds' then
    s.receiver_id:=null; s.receiver_hash:=null; s.receiver_seen:=null; s.approved:=false; s.offer:=null; s.answer:=null;
  end if;
  if p_action='join' then
    if s.receiver_id is not null and s.receiver_hash is distinct from sha256(convert_to(v_key,'UTF8')) then
      return jsonb_build_object('error','This stage already has a receiver. Ask the host to disconnect it.','status',409);
    end if;
    if s.receiver_id is null then s.receiver_id:=gen_random_uuid(); s.receiver_hash:=sha256(convert_to(v_key,'UTF8')); end if;
    s.receiver_seen:=v_now;
  elsif not v_host then
    if s.receiver_hash is null or s.receiver_hash is distinct from sha256(convert_to(v_key,'UTF8')) then
      return jsonb_build_object('error','Receiver disconnected','status',403);
    end if;
    s.receiver_seen:=v_now;
  end if;
  if p_action in ('approve','reject','offer','answer','reset') then
    v_receiver:=(p_payload->>'receiverId')::uuid;
    if s.receiver_id is null or s.receiver_id is distinct from v_receiver then return jsonb_build_object('error','Receiver changed','status',409); end if;
  end if;
  case p_action
    when 'approve' then s.approved:=true;
    when 'reject' then s.receiver_id:=null; s.receiver_hash:=null; s.receiver_seen:=null; s.approved:=false; s.offer:=null; s.answer:=null;
    when 'leave' then s.receiver_id:=null; s.receiver_hash:=null; s.receiver_seen:=null; s.approved:=false; s.offer:=null; s.answer:=null;
    when 'reset' then s.receiver_id:=gen_random_uuid(); s.offer:=null; s.answer:=null;
    when 'offer' then
      if not s.approved or s.offer is not null then return jsonb_build_object('error','Offer not allowed','status',409); end if;
      s.offer:=v_sdp;
    when 'answer' then
      if not s.approved or s.offer is null or s.answer is not null then return jsonb_build_object('error','Answer not allowed','status',409); end if;
      s.answer:=v_sdp;
    when 'stop' then
      update public.performance_stage_links set revoked_at=v_now where id=v_id;
      delete from public.web_cast_sessions where link_id=v_id;
      return jsonb_build_object('stopped',true);
    else null;
  end case;
  update public.web_cast_sessions set host_seen=s.host_seen, receiver_id=s.receiver_id, receiver_hash=s.receiver_hash,
    receiver_seen=s.receiver_seen, approved=s.approved, offer=s.offer, answer=s.answer where link_id=v_id;
  return jsonb_build_object('id',v_id,'expiresAt',l.expires_at,'receiverId',s.receiver_id,'approved',s.approved,
    'offer',case when s.approved and not v_host then s.offer else null end,
    'hasOffer',s.offer is not null,'answer',case when v_host then s.answer else null end);
end $$;
revoke all on function public.web_cast_command(text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.web_cast_command(text,uuid,jsonb) to service_role;
commit;
