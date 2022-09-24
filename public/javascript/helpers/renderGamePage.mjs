import { addClass, removeClass } from "./domHelper.mjs";
import { socket } from "../game.mjs";
import { showMessageModal } from "../views/modal.mjs";

let ready = false;
let textLength = 0;
let completed = 0;

const NONE = "display-none"
const READY_BTN_REF = document.querySelector('#ready-btn');
const TIMER_REF = document.querySelector('#timer');
const TEXT_CONTAINER_REF = document.querySelector('#text-container');
const GAME_CONTAINER_TIMER_REF = document.querySelector('#game-timer');
const GAME_TIMER_REF = document.querySelector('#game-timer-seconds');
const QUIT_BTN_REF = document.querySelector('#quit-room-btn');
const COMPLETED_REF = document.querySelector('#text-completed');
const TEXT_REF = document.querySelector('#text');

export const renderGamePage = (data) => {
  document.querySelector('#room-name').textContent = data.roomId;
  QUIT_BTN_REF.onclick = () => location.reload();
  READY_BTN_REF.onclick = () => readyBtnHandler(data.username, data.roomId);
  addClass(document.querySelector('#rooms-page'), NONE);
  removeClass(document.querySelector('#game-page'), NONE);
}

export const renderGamePreview = async ({ time, id }) => {
  let currentTime = time;
  addClass(QUIT_BTN_REF, NONE);
  addClass(READY_BTN_REF, NONE);
  removeClass(TIMER_REF, NONE);
  TIMER_REF.textContent = currentTime;
  try {
    TEXT_REF.innerHTML = await fetch(`http://localhost:3002/text/${id}`).then((response) => (response.ok ? response.json() : Promise.reject(Error('Failed to load'))))

      .catch((error) => {
        throw error;
      });
    textLength = TEXT_REF.innerHTML.length;
  } catch (error) {
    showMessageModal(error)
  }
  const intervalId = setInterval(() => {
    if (currentTime === 0) {
      clearInterval(intervalId);
      TIMER_REF.textContent = "GO!";
      return;
    };
    currentTime--;
    TIMER_REF.textContent = currentTime;
  }, 1000)
}

export const renderGame = (data, socket) => {
  const { room, username } = data;
  completed = 0;
  addClass(TIMER_REF, NONE);
  removeClass(TEXT_CONTAINER_REF, NONE);
  removeClass(GAME_CONTAINER_TIMER_REF, NONE);
  GAME_TIMER_REF.textContent = data.time;
  window.addEventListener('keypress', (e) => {
    if (e.key !== TEXT_REF.innerHTML[0]) return;
    COMPLETED_REF.innerHTML = COMPLETED_REF.innerHTML + TEXT_REF.innerHTML[0];
    TEXT_REF.innerHTML = TEXT_REF.innerHTML.substring(1);
    completed++
    socket.emit("game/update-symbol", { completed, textLength, room, username })
  })
}

export const updateGameTimer = (value) => {
  GAME_TIMER_REF.textContent = value
}

const readyBtnHandler = (username, room) => {
  socket.emit("game/update-ready", { username, room, ready: !ready })
  ready = !ready;
  READY_BTN_REF.textContent = ready ? 'NOT READY' : "READY";
}