# STAGELESS Cast — application integration

After the backend patch is deployed and the receiver domain configured, open the existing Cast Output popover in the desktop application or standard browser visualizer. A new **Web Casting** category appears before Wireless Displays. Sign into the same Supabase project, select an aspect ratio (16:9 is the default), and choose Create Cast Session. Enter the code on `https://cast.stagelessstudio.com`, scan the QR link on the receiving device, or copy the secure link. Approve the receiver from the sender. Close the popover without ending the stream; reopen it to disconnect the receiver, stop the output, or approve another receiver. The cast preview button becomes available when connected.

The implementation uses the existing `createRelayCapture`/`startRelayFramePump` path, including frame announcements, aspect-ratio lock, source handoff, pressure-aware cadence, and video-only capture. The existing native provider contracts, engine implementations, preset choreography and native broadcaster are not changed. Web casting supports one output destination and is mutually exclusive with native casting. It is stopped when the output capability becomes unavailable (including the existing Fractures restriction), the user signs out, or the host component unmounts. The visualizer keep-alive router now includes web cast activity, so managers can be opened while the standard React visualizer is casting. Keep the sender app open; OS sleep, background browser throttling, and mobile-specific navigation are not guaranteed. The separate mobile performance sender UI is outside this patch. Browser receivers can run on compatible mobile devices.

## Verification checklist

- Apply backend patch and deploy; configure TURN; deploy site. Build app normally with the same public Supabase settings.
- Run `npm run typecheck` and `npx vitest run src/components/vyzualz/react/output/OutputCastControl.test.tsx src/components/vyzualz/react/output/OutputCastProductionPath.test.tsx src/components/vyzualz/react/output/webCastQr.test.ts`.
- Desktop + standard browser sender: create, cancel, approve, deny, preview, stop; test valid/invalid code and QR; verify stop, sign-out, reconnect, expiry and native casting still work.
- Try engine/preset switches, six aspect ratios, opening managers while casting, and switching to an unsupported output. Compare actual remote visuals, not only status.
- Verify a second receiver is denied, QR link is stripped from receiver URL, and cross-network playback works with TURN. Test Chrome, Safari, TV browser targets and real venue Wi-Fi separately.

No new npm dependencies are required by the application patch. The QR generator is local and does not send a secret URL to a third-party QR service.
