import { io } from 'socket.io-client';

const A_ID = '64a7f0e4b5e4c123456789ab';
const socket = io('http://localhost:3000', {
  query: { userId: A_ID },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('A connected', socket.id);
});

socket.on('receive_message', (msg) => {
  console.log('A got:', msg);
});

function send(msg) {
  socket.emit('send_message', msg);
}

global.send = send;

import repl from 'repl';

const r = repl.start({ prompt: 'A> ' });
r.context.send = send;
