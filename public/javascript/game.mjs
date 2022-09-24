import { renderGame, renderGamePage, renderGamePreview, updateGameTimer } from "./helpers/renderGamePage.mjs";
import { showInputModal, showMessageModal, showResultsModal } from "./views/modal.mjs";
import { appendRoomElement, removeRoomElement, updateNumberOfUsersInRoom } from "./views/room.mjs";
import { appendUserElement, changeReadyStatus, removeUserElement, setProgress } from "./views/user.mjs";

const username = sessionStorage.getItem('username');

if (!username) {
	window.location.replace('/login');
}

export const socket = io(`http://localhost:3002/game`, { query: { username } });

const roomSubmitHandler = () => {
	socket.emit('room/add', document.querySelector('.modal-input').value);
}

const onJoinHandler = (roomName) => socket.emit("room/join", roomName)

document.querySelector('#add-room-btn').onclick = () => showInputModal({ title: "Type room name:", onSubmit: roomSubmitHandler });

socket.on("error/nameTaken", (data) => showMessageModal({
	message: data, onClose: () => {
		sessionStorage.removeItem('username')
		window.location.replace('/login')
	}
}))

socket.on(
	"error/roomNameTaken",
	(data) => showMessageModal({ message: data })
)
socket.on(
	"error/too-much-users",
	(data) => showMessageModal({ message: data })
)

socket.on(
	"room/add-success",
	(data) => {
		const roomData = JSON.parse(data);
		appendRoomElement({ ...roomData, onJoin: () => onJoinHandler(roomData.name) })
	}
)
socket.on(
	"room/userAdd-success",
	(data) => {
		const roomData = JSON.parse(data);
		appendRoomElement({ ...roomData, onJoin: () => onJoinHandler(roomData.name) });
		socket.emit("room/join", roomData.name);
	}
)

socket.on(
	"room/restore",
	(data) => {
		Object.keys(data).forEach(element => {
			if (!data[element].available) return;
			appendRoomElement({ name: element, numberOfUsers: data[element].users.length, onJoin: () => onJoinHandler(element) })
		})
	}
)

socket.on("room/remove", (room) => {
	removeRoomElement(room)
})

socket.on("room/update-connected",
	(data) => {
		updateNumberOfUsersInRoom(JSON.parse(data))
	})

socket.on("room/join-success", (data) => {
	renderGamePage(data);
	data.usersData.forEach(elem => appendUserElement({
		username: elem.username,
		ready: elem.ready,
		isCurrentUser: elem.username === data.username
	}))

})

socket.on("game/connected", (username) => {
	appendUserElement({ username, ready: false, isCurrentUser: false })
})
socket.on("game/disconnected", (username) => {
	removeUserElement(username)
})
socket.on("game/update-ready", (data) => {
	changeReadyStatus(data)
})

socket.on("game/start-fetching", (data) => renderGamePreview(data));
socket.on("game/start", (data) => renderGame(data, socket));
socket.on("game/end", (data) => showResultsModal({ usersSortedArray: data, onClose: () => location.reload() }));
socket.on("game/update-timer", (data) => updateGameTimer(data));
socket.on("game/update-progress", data => setProgress(data))
