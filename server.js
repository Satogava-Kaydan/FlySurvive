// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;
const rooms = new Map();

// Раздаем статические файлы
app.use(express.static(__dirname));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  console.log('🎮 Игрок подключился:', socket.id);

  // Проверка комнаты из URL
  socket.on('checkRoomFromUrl', (roomId) => {
    const room = rooms.get(roomId.toUpperCase());
    if (room && room.status === 'waiting') {
      socket.emit('autoJoinRoom', { roomId: roomId.toUpperCase() });
    }
  });

  // Создание комнаты
  socket.on('createRoom', () => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    rooms.set(roomId, {
      players: [socket.id],
      board: Array(9).fill(null),
      currentPlayer: 'X',
      status: 'waiting',
      createdAt: new Date()
    });
    
    socket.join(roomId);
    
    // Генерируем правильную ссылку
    const gameLink = `http://localhost:${PORT}/?room=${roomId}`;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎲 КОМНАТА СОЗДАНА!');
    console.log('='.repeat(60));
    console.log(`📋 ID комнаты: ${roomId}`);
    console.log(`🔗 Ссылка для игры: ${gameLink}`);
    console.log('📱 Откройте эту ссылку в другом окне или браузере');
    console.log('📱 или отправьте другу для совместной игры');
    console.log('='.repeat(60) + '\n');
    
    // Отправляем клиенту
    socket.emit('roomCreated', { 
      roomId, 
      gameLink,
      message: `Комната ${roomId} создана!`
    });
  });

  // Присоединение к комнате
  socket.on('joinRoom', (roomId) => {
    const room = rooms.get(roomId.toUpperCase());
    
    if (!room) {
      socket.emit('error', { message: '❌ Комната не найдена' });
      console.log(`❌ Попытка присоединиться к несуществующей комнате: ${roomId}`);
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('error', { message: '❌ Комната заполнена' });
      console.log(`❌ Комната ${roomId} уже заполнена`);
      return;
    }
    
    // Добавляем игрока
    room.players.push(socket.id);
    room.status = 'playing';
    socket.join(roomId);
    
    console.log(`\n🎯 Игрок ${socket.id} присоединился к комнате ${roomId}`);
    console.log(`👥 Игроков в комнате: ${room.players.length}/2\n`);
    
    // Отправляем подтверждение
    socket.emit('roomJoined', { 
      roomId: roomId.toUpperCase(),
      message: `Вы в комнате ${roomId}`
    });
    
    // Назначаем символ
    const playerSymbol = room.players[0] === socket.id ? 'X' : 'O';
    socket.emit('assignSymbol', playerSymbol);
    
    // Стартуем игру
    io.to(roomId).emit('gameStart', {
      board: room.board,
      currentPlayer: room.currentPlayer,
      players: room.players.length
    });
    
    console.log(`🎮 Игра началась в комнате ${roomId}!`);
  });

  // Обработка хода
  socket.on('makeMove', ({ roomId, cellIndex, symbol }) => {
    const room = rooms.get(roomId);
    
    if (!room || room.status !== 'playing') return;
    if (room.board[cellIndex] !== null) return;
    if (symbol !== room.currentPlayer) return;
    
    // Делаем ход
    room.board[cellIndex] = symbol;
    
    // Проверяем победителя
    const winner = checkWinner(room.board);
    if (winner) {
      room.status = 'finished';
      console.log(`\n🏆 ПОБЕДА в комнате ${roomId}! Победитель: ${winner}\n`);
      io.to(roomId).emit('gameOver', { 
        winner, 
        board: room.board,
        message: `🎉 Победитель: ${winner}!`
      });
    } else if (room.board.every(cell => cell !== null)) {
      // Ничья
      room.status = 'finished';
      console.log(`\n🤝 НИЧЬЯ в комнате ${roomId}!\n`);
      io.to(roomId).emit('gameOver', { 
        winner: 'draw', 
        board: room.board,
        message: '🤝 Ничья!'
      });
    } else {
      // Смена игрока
      room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
      io.to(roomId).emit('updateGame', {
        board: room.board,
        currentPlayer: room.currentPlayer
      });
    }
  });

  // Перезапуск игры
  socket.on('restartGame', (roomId) => {
    const room = rooms.get(roomId);
    
    if (room) {
      room.board = Array(9).fill(null);
      room.currentPlayer = 'X';
      room.status = 'playing';
      
      console.log(`\n🔄 Игра перезапущена в комнате ${roomId}\n`);
      
      io.to(roomId).emit('gameRestart', {
        board: room.board,
        currentPlayer: room.currentPlayer
      });
    }
  });

  // Отключение игрока
  socket.on('disconnect', () => {
    console.log(`❌ Игрок отключился: ${socket.id}`);
    
    // Удаляем игрока из комнат
    for (const [roomId, room] of rooms.entries()) {
      const index = room.players.indexOf(socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        
        if (room.players.length === 0) {
          rooms.delete(roomId);
          console.log(`🗑️ Комната ${roomId} удалена (нет игроков)`);
        } else {
          io.to(roomId).emit('opponentDisconnected');
          console.log(`⚠️ В комнате ${roomId} остался 1 игрок`);
        }
        break;
      }
    }
  });
});

// Проверка победителя
function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // строки
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // столбцы
    [0, 4, 8], [2, 4, 6]             // диагонали
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🎮 СЕРВЕР КРЕСТИКИ-НОЛИКИ ЗАПУЩЕН');
  console.log('='.repeat(60));
  console.log(`📍 Откройте в браузере: http://localhost:${PORT}`);
  console.log('🎯 Как играть:');
  console.log('   1. Откройте ссылку выше');
  console.log('   2. Нажмите "Создать комнату"');
  console.log('   3. Скопируйте ссылку из этой консоли');
  console.log('   4. Отправьте другу или откройте в другом окне');
  console.log('='.repeat(60) + '\n');
});