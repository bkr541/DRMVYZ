-- Run on a development or staging database after migration 0061. Rolls back all changes.
begin;
create function pg_temp.cast_assert(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Assertion failed: %', message; end if; end $$;
insert into auth.users(id,email) values ('a0610000-0000-4000-8000-000000000001','cast-a@example.invalid'),('b0610000-0000-4000-8000-000000000001','cast-b@example.invalid');
select pg_temp.cast_assert(not has_function_privilege('anon','public.web_cast_command(text,uuid,jsonb)','EXECUTE'),'anonymous RPC is prohibited');
select pg_temp.cast_assert(not has_function_privilege('authenticated','public.web_cast_command(text,uuid,jsonb)','EXECUTE'),'client RPC is prohibited');
select pg_temp.cast_assert(not has_table_privilege('authenticated','public.web_cast_sessions','SELECT'),'signaling table is private');
do $$
declare
  a uuid:='a0610000-0000-4000-8000-000000000001'; b uuid:='b0610000-0000-4000-8000-000000000001';
  host jsonb; viewer jsonb; base jsonb; creds jsonb; generation jsonb; offer jsonb:='{"type":"offer","sdp":"v=0"}'; answer jsonb:='{"type":"answer","sdp":"v=0"}';
  r jsonb; i integer;
begin
  perform pg_temp.cast_assert((public.web_cast_command('create',null,'{}')->>'status')='401','host must sign in');
  host:=public.web_cast_command('create',a,'{}'); base:=jsonb_build_object('id',host->>'id');
  perform pg_temp.cast_assert(length(host->>'code')=6 and length(host->>'token')=64,'create returns two credentials');
  perform pg_temp.cast_assert((public.web_cast_command('create',a,'{}')->>'status')='409','one session per host');
  perform pg_temp.cast_assert((public.web_cast_command('hostPoll',b,base)->>'status')='404','other account cannot access host');
  viewer:=public.web_cast_command('join',null,jsonb_build_object('code',host->>'code','receiverKey',repeat('a',64),'bucket',repeat('b',64)));
  creds:=base||jsonb_build_object('receiverKey',repeat('a',64)); generation:=jsonb_build_object('receiverId',viewer->>'receiverId');
  perform pg_temp.cast_assert(viewer->>'receiverId' is not null and (viewer->>'approved')='false','join requires approval');
  perform pg_temp.cast_assert((public.web_cast_command('join',null,jsonb_build_object('token',host->>'token','receiverKey',repeat('c',64),'bucket',repeat('b',64)))->>'status')='409','second receiver denied');
  perform pg_temp.cast_assert((public.web_cast_command('offer',a,base||generation||jsonb_build_object('description',offer))->>'status')='409','no offer before approval');
  perform pg_temp.cast_assert((public.web_cast_command('receiverPoll',null,base||jsonb_build_object('receiverKey',repeat('d',64)))->>'status')='403','wrong credential denied');
  perform public.web_cast_command('approve',a,base||generation);
  perform public.web_cast_command('offer',a,base||generation||jsonb_build_object('description',offer));
  perform pg_temp.cast_assert(public.web_cast_command('receiverPoll',null,creds)->'offer'=offer,'approved receiver gets offer');
  perform public.web_cast_command('answer',null,creds||generation||jsonb_build_object('description',answer));
  perform pg_temp.cast_assert(public.web_cast_command('hostPoll',a,base)->'answer'=answer,'owner receives answer');
  r:=public.web_cast_command('reset',null,creds||generation);
  perform pg_temp.cast_assert(r->>'receiverId' is distinct from viewer->>'receiverId' and (r->>'hasOffer')='false','reset changes negotiation generation');
  perform pg_temp.cast_assert((public.web_cast_command('offer',a,base||generation||jsonb_build_object('description',offer))->>'status')='409','stale SDP rejected');
  perform public.web_cast_command('leave',null,creds);
  viewer:=public.web_cast_command('join',null,jsonb_build_object('token',host->>'token','receiverKey',repeat('e',64),'bucket',repeat('b',64)));
  perform pg_temp.cast_assert(viewer->>'receiverId' is not null and (viewer->>'approved')='false','QR rejoin requires approval');
  perform public.web_cast_command('stop',a,base);
  perform pg_temp.cast_assert((public.web_cast_command('hostPoll',a,base)->>'status')='404','stop invalidates session');
  for i in 1..13 loop r:=public.web_cast_command('join',null,jsonb_build_object('code','AAAAAA','receiverKey',repeat('a',64),'bucket',repeat('f',64))); end loop;
  perform pg_temp.cast_assert(r->>'status'='429','durable rate limit');
end $$;
rollback;
