import { Server } from 'socket.io';
import { texts } from '../data';
import * as config from './config';

import { roomData, userData } from '../interfaces/sockets';

const users: Map<string, string> = new Map();
const rooms: Map<string, roomData> = new Map();

const getCurrentRoomId = socket => Object.keys(socket.rooms).find(roomId => rooms.has(roomId));

export default (io: Server): void => {
  io.on('connection', socket => {
    const username = socket.handshake.query.username as string;
    if (users.has(username)) {
      socket.emit("error/nameTaken", `User "${username}" is already online`);
      return;
    }
    users.set(username, socket.id);
    socket.emit("room/restore", Object.fromEntries(rooms))

    socket.on("room/add", (roomName) => {
      if (rooms.has(roomName)) socket.emit("error/roomNameTaken", `Room "${roomName}" already exist`)
      else {
        rooms.set(roomName, { users: [], startTimer: config.SECONDS_TIMER_BEFORE_START_GAME, timer: config.SECONDS_FOR_GAME, available: true, started: false })
        socket.broadcast.emit("room/add-success", JSON.stringify({ name: roomName, numberOfUsers: rooms.get(roomName)?.users.length }))
        socket.emit("room/userAdd-success", JSON.stringify({ name: roomName, numberOfUsers: rooms.get(roomName)?.users.length }))
      }
    })

    socket.on("room/join", roomId => {
      const roomInfo: roomData | undefined = rooms.get(roomId);
      if (!roomInfo) return;
      const prevRoomId = getCurrentRoomId(socket);
      if (roomId === prevRoomId) {
        return;
      }
      if (roomInfo?.users.length === config.MAXIMUM_USERS_FOR_ONE_ROOM) {
        socket.emit("error/too-much-users", "Too much users in this room")
        return;
      }
      if (prevRoomId) {
        socket.leave(prevRoomId);
      }
      socket.join(roomId);
      const usersData = roomInfo?.users as userData[];
      usersData.push({ username, ready: false, completed: 0, total: 0 });
      if (usersData.length === config.MAXIMUM_USERS_FOR_ONE_ROOM) {
        roomInfo.available = false;
        socket.broadcast.emit("room/remove", roomId);
      }
      io.to(socket.id).emit("room/join-success", { usersData, roomId, username });
      socket.broadcast.to(roomId).emit("game/connected", username);
      socket.broadcast.emit("room/update-connected", JSON.stringify({ name: roomId, numberOfUsers: usersData.length }))
    });

    socket.on("game/update-ready", (data) => {
      const roomInfo: roomData | undefined = rooms.get(data.room);
      if (!roomInfo) return;
      const updatedUser: userData[] = (roomInfo?.users as userData[]).map((item) => item.username === data.username ? { ...item, ready: data.ready } : item)
      rooms.set(data.room, {
        ...roomInfo,
        users: updatedUser
      });
      if (updatedUser.length > 1 && updatedUser.every((user) => user.ready)) startFetching(socket, data.room, username);
      socket.broadcast.to(data.room).emit("game/update-ready", data);
      io.to(socket.id).emit("game/update-ready", data);
    })

    socket.on("game/update-symbol", data => {
      socket.broadcast.to(data.room).emit("game/update-progress", { username, progress: data.completed / data.textLength * 100 });
      io.to(socket.id).emit("game/update-progress", { username, progress: data.completed / data.textLength * 100 });

      const roomInfo: roomData | undefined = rooms.get(data.room);
      if (!roomInfo) return;

      const updatedUser = roomInfo.users.find(item => item.username === username);
      if (!updatedUser) return;
      updatedUser.completed = data.completed;
      updatedUser.total = data.textLength;
      roomInfo.users = [...roomInfo.users.filter(item => item.username !== username), updatedUser] as userData[];
      if (roomInfo.users.every(user => user.completed !== 0 && user.completed === user.total)) {
        endGame(socket, data.room, roomInfo)
      }
    })
    socket.on("disconnect", () => {
      if (users.get(username) !== socket.id) return;
      users.delete(username);

      rooms.forEach((data, room) => {
        if (data.users.find((user) => user.username === username)) {
          const filteredData = data.users.filter((user) => user.username !== username);
          socket.broadcast.to(room).emit("game/disconnected", username);
          console.log(filteredData)

          if ((filteredData.length !== config.MAXIMUM_USERS_FOR_ONE_ROOM) && !rooms.get(room)?.started) {
            !rooms.get(room)!.available && socket.broadcast.emit("room/add-success", JSON.stringify({ name: room, numberOfUsers: rooms.get(room)?.users.length }));
            rooms.get(room)!.available = true;
          }

          rooms.set(room, ({ ...rooms.get(room), users: filteredData } as roomData));

          if (rooms.get(room)?.users.every((user) => user.completed !== 0 && (user.completed === user.total))) {
            endGame(socket, room, rooms.get(room))
          };

          socket.broadcast.emit("room/update-connected", JSON.stringify({ name: room, numberOfUsers: filteredData.length }))
          if (filteredData.length === 0) {
            socket.broadcast.emit('room/remove', room);
            rooms.delete(room)
          }
        }
      })
    });
  });
};

const random = (max: number): number => {
  const num: number = Math.random() * (max);
  return Math.round(num);
};

const startFetching = (socket, room, username) => {
  const roomInfo: roomData | undefined = rooms.get(room);
  if (!roomInfo) return;
  roomInfo.available = false;
  roomInfo.started = true;
  socket.broadcast.emit("room/remove", room);
  const textLength = texts.length;
  const randomNum: number = random(textLength - 1);
  socket.emit("game/start-fetching", { time: roomInfo.startTimer, id: randomNum });
  socket.broadcast.to(room).emit("game/start-fetching", { time: roomInfo.startTimer, id: randomNum });
  setTimeout(() => {
    startGame(socket, room, roomInfo, username)
  }, roomInfo.startTimer * 1000)
}

const startGame = (socket, room, roomInfo, username) => {
  socket.emit("game/start", { time: roomInfo.timer, room, username })
  socket.broadcast.to(room).emit("game/start", { time: roomInfo.timer, room, username })
  const intervalId = setInterval(() => {
    socket.emit("game/update-timer", roomInfo.timer)
    socket.broadcast.to(room).emit("game/update-timer", roomInfo.timer)
    if (roomInfo.timer === 0) {
      clearInterval(intervalId);
      endGame(socket, room, roomInfo)
      return;
    };
    roomInfo.timer--;
  }, 1000)
}

const endGame = (socket, room, roomInfo) => {
  rooms.delete(room);
  roomInfo.users.sort((a, b) => b.completed - a.completed)
  socket.emit("game/end", roomInfo.users);
  socket.broadcast.to(room).emit("game/end", roomInfo.users);
}