import { io } from 'socket.io-client';

const B_ID = '64a7f0e4b5e4c123456789ac';
const socket = io('http://localhost:3000', {
  query: { userId: B_ID },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('B connected', socket.id);
});

socket.on('receive_message', (msg) => {
  console.log('B got:', msg);
});

function send(msg) {
  socket.emit('send_message', msg);
}

global.send = send;

import repl from 'repl';

const r = repl.start({ prompt: 'B> ' });
r.context.send = send;
