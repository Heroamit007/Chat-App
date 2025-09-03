(function () {
  const socket = io();

  const roomsUl = document.getElementById('rooms');
  const roomForm = document.getElementById('room-form');
  const roomInput = document.getElementById('room-input');
  const leaveBtn = document.getElementById('leave-btn');
  const messages = document.getElementById('messages');
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const typingEl = document.getElementById('typing');

  let currentRoom = window.CHAT.initialRoom;

  function addRoomPill(room, active = false) {
    const li = document.createElement('li');
    li.className = 'pill' + (active ? ' active' : '');
    li.dataset.room = room;
    li.textContent = `#${room}`;
    li.onclick = () => switchRoom(room);
    roomsUl.appendChild(li);
  }

  function setActiveRoom(room) {
    document.querySelectorAll('#rooms .pill').forEach(p => {
      p.classList.toggle('active', p.dataset.room === room);
    });
  }

  function switchRoom(room) {
    if (room === currentRoom) return;
    socket.emit('leave', { room: currentRoom });
    currentRoom = room;
    setActiveRoom(room);
    messages.innerHTML = ''; // clear chat view
    socket.emit('join', { room });
  }

  function appendMessage(html) {
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  // Join initial room
  socket.emit('join', { room: currentRoom });
  addRoomPill('general', true);

  // Send message
  function send() {
    const text = input.value.trim();
    if (!text) return;
    socket.emit('send_message', { room: currentRoom, text });
    input.value = '';
  }

  sendBtn.onclick = send;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send();
    else socket.emit('typing', { room: currentRoom });
  });

  // Join/Leave room via form/buttons
  roomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const room = (roomInput.value || '').trim();
    if (!room) return;
    // Add pill if not exists
    if (!document.querySelector(`.pill[data-room="${room}"]`)) {
      addRoomPill(room);
    }
    switchRoom(room);
    roomInput.value = '';
  });

  leaveBtn.addEventListener('click', () => {
    if (currentRoom !== 'general') {
      socket.emit('leave', { room: currentRoom });
      switchRoom('general');
    }
  });

  // Socket events
  socket.on('system', (data) => {
    if (data.room !== currentRoom) return;
    appendMessage(`<div class="system">🔔 ${data.message}</div>`);
  });

  socket.on('new_message', (msg) => {
    if (msg.room !== currentRoom) return;
    const ts = new Date(msg.ts * 1000).toLocaleTimeString();
    appendMessage(`<div><b>${msg.user}</b> <span class="ts">${ts}</span><br>${escapeHtml(msg.text)}</div>`);
  });

  socket.on('typing', (data) => {
    if (data.room !== currentRoom) return;
    typingEl.textContent = `${data.user} is typing…`;
    typingEl.classList.remove('hide');
    clearTimeout(window.__typingTimer);
    window.__typingTimer = setTimeout(() => typingEl.classList.add('hide'), 800);
  });

  // simple html escape
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();
