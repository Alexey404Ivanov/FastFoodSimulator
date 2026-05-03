const simulationId = 1488
const payloadStorageKey = `simulation:${simulationId}:payload`
const sessionStartedKey = `simulation:${simulationId}:started`

const startButton = document.querySelector(".control-button")
const stopButton = document.querySelector(".control-button-stop")
const timerDisplay = document.querySelector(".timer-display")
const cashierCurrentClient = document.getElementById("cashierCurrentClient")
const cashierQueue = document.getElementById("cashierQueue")

let state = {
  status: "paused",
  cashier: {
    doing: 1,
    queue: [2, 3, 4, 5, 6, 7]
  }
}

let timeOffset = 0
let elapsedBeforeRunMs = 0
let runningSinceLocalMs = null
let timerIntervalId = null

const protocol = window.location.protocol === "https:" ? "wss" : "ws"

const ws = new WebSocket(
  `${protocol}://${window.location.host}/api/simulation/${simulationId}/events`
)

ws.onopen = () => {
  console.log("WS connected")
}

ws.onclose = () => {
  console.log("WS disconnected")
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  console.log(msg)
  handleEvent(msg)
}

startButton?.addEventListener("click", handleStart)
stopButton?.addEventListener("click", handlePause)

function handleEvent(msg) {
  switch (msg.type) {
    case "init":
      handleInit(msg)
      break

    case "simulation_status_changed":
      handleStatusChanged(msg)
      break

    case "pushed_to_cashier_queue":
      handleCashierQueuePushed(msg)
      break

    case "cashier_queue_updated":
    case "popped_from_cashier_queue":
      handleCashierQueuePopped(msg)
      break

    case "cashier_started_processing":
      handleCashierStarted(msg)
      break

    case "cashier_waiting":
      handleCashierWaiting()
      break

    default:
      console.warn("Unknown event:", msg)
  }
}

function handleInit(msg) {
  state = {
    status: msg.data?.status ?? "paused",
    cashier: {
      doing: msg.data?.cashier?.doing ?? null,
      queue: msg.data?.cashier?.queue ?? []
    }
  }

  if (msg.server_now) {
    timeOffset = Date.now() - msg.server_now
  }

  if (state.status === "running") {
    runningSinceLocalMs = Date.now()
    ensureTimer()
    markSessionStarted()
  } else {
    stopTimer()
  }

  renderAll()
}

function handleStatusChanged(msg) {
  const nextStatus = msg.data.status
  syncTimerState(nextStatus)
  state.status = nextStatus
  renderStatus()
  renderTimer()
}

function handleCashierQueuePushed(msg) {
  state.cashier.queue = msg.data.queue
  renderQueue()
}

function handleCashierQueuePopped(msg) {
  state.cashier.queue = msg.data.queue
  renderQueue()
}

function handleCashierStarted(msg) {
  state.cashier.doing = msg.data.entity_id
  renderCashier()
}

function handleCashierWaiting() {
  state.cashier.doing = null
  renderCashier()
}

function renderAll() {
  renderStatus()
  renderCashier()
  renderQueue()
  renderTimer()
}

function renderStatus() {
  if (startButton) {
    startButton.disabled = state.status === "running"
  }

  if (stopButton) {
    stopButton.disabled = state.status !== "running"
  }
}

function renderCashier() {
  cashierCurrentClient.innerHTML = state.cashier.doing
    ? createClientCard(state.cashier.doing)
    : '<div class="client-card-empty">Нет клиента</div>'
}

function renderQueue() {
  if (!state.cashier.queue.length) {
    cashierQueue.innerHTML = '<div class="client-card-empty">Очередь пуста</div>'
    return
  }

  cashierQueue.innerHTML = state.cashier.queue
    .map((clientId) => createClientCard(clientId))
    .join("")
}

function createClientCard(clientId) {
  return `
    <div class="client-card">
      <img src="../static/images/захар.svg" alt="Client #${clientId}">
    </div>
  `
}
renderCashier()
renderQueue()

function renderTimer() {
  if (!timerDisplay) {
    return
  }

  timerDisplay.textContent = `Время работы симуляции: ${formatElapsed(getElapsedMs())}`
}

function getElapsedMs() {
  if (state.status !== "running" || !runningSinceLocalMs) {
    return elapsedBeforeRunMs
  }

  return elapsedBeforeRunMs + (Date.now() - runningSinceLocalMs)
}

function formatElapsed(totalMs) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000))
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0")
  const seconds = String(totalSeconds % 60).padStart(2, "0")
  return `${minutes}.${seconds}`
}

function syncTimerState(nextStatus) {
  if (state.status === "running" && runningSinceLocalMs) {
    elapsedBeforeRunMs += Date.now() - runningSinceLocalMs
    runningSinceLocalMs = null
  }

  if (nextStatus === "running") {
    runningSinceLocalMs = Date.now()
    ensureTimer()
    markSessionStarted()
    return
  }

  stopTimer()
}

function ensureTimer() {
  if (timerIntervalId !== null) {
    return
  }

  timerIntervalId = window.setInterval(renderTimer, 1000)
}

function stopTimer() {
  if (timerIntervalId !== null) {
    window.clearInterval(timerIntervalId)
    timerIntervalId = null
  }
}

async function handleStart() {
  const payload = loadStoredPayload()
  const endpoint = hasStartedInSession() ? "/api/simulation/continue" : "/api/simulation/start"
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  }

  if (endpoint === "/api/simulation/start") {
    options.body = JSON.stringify(payload)
  }

  try {
    const response = await fetch(endpoint, options)

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    markSessionStarted()
  } catch (error) {
    console.error("Start request failed:", error)
  }
}

async function handlePause() {
  try {
    const response = await fetch("/api/simulation/pause", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }
  } catch (error) {
    console.error("Pause request failed:", error)
  }
}

function loadStoredPayload() {
  const rawPayload = window.sessionStorage.getItem(payloadStorageKey)

  if (rawPayload) {
    try {
      return JSON.parse(rawPayload)
    } catch (error) {
      console.error("Failed to parse stored payload:", error)
    }
  }

  return {
    client_interval_seconds: 5,
    cashier_interval_seconds: 5,
    kitchen_interval_seconds: 5,
    waiter_interval_seconds: 5
  }
}

function hasStartedInSession() {
  return window.sessionStorage.getItem(sessionStartedKey) === "true"
}

function markSessionStarted() {
  window.sessionStorage.setItem(sessionStartedKey, "true")
}

window.debugState = () => console.log(state)
