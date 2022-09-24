export interface userData {
  username: string,
  ready: false,
  completed: number
  total: number
}
export interface roomData {
  started: boolean,
  available: boolean,
  startTimer: number,
  timer: number,
  users: userData[]
}