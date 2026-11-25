import { parseWebCastRequest } from './webCastCore.ts'
const key='a'.repeat(64), id='12345678-1234-1234-1234-123456789abc'
Deno.test('web cast validates codes and strips untrusted owner fields', () => {
  const result=parseWebCastRequest({action:'join',code:'ABC234',receiverKey:key,owner:'evil'})
  if (!result || 'owner' in result.payload) throw Error('unsafe parse')
  if (parseWebCastRequest({action:'join',code:'ABC123',receiverKey:key})) throw Error('ambiguous code accepted')
})
Deno.test('web cast validates SDP, receiver generation and secrets', () => {
  if (parseWebCastRequest({action:'answer',id,receiverId:id,description:{type:'answer',sdp:'v=0'}})) throw Error('missing credential accepted')
  if (parseWebCastRequest({action:'offer',id,receiverId:id,description:{type:'answer',sdp:'v=0'}})) throw Error('wrong SDP accepted')
  if (!parseWebCastRequest({action:'offer',id,receiverId:id,description:{type:'offer',sdp:'v=0\r\n'}})) throw Error('valid offer rejected')
})
