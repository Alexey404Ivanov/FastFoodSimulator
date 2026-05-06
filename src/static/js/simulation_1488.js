const simulationId = 1488
const payloadStorageKey = `simulation:${simulationId}:payload`
const sessionStartedKey = `simulation:${simulationId}:started`

const startButton = document.querySelector(".control-button")
const stopButton = document.querySelector(".control-button-stop")
const timerDisplay = document.querySelector(".timer-display")
const kitchenDoing = document.getElementById("kitchenDoing")
const kitchenQueue = document.getElementById("kitchenQueue")
const cashierCurrentClient = document.getElementById("cashierCurrentClient")
const cashierQueue = document.getElementById("cashierQueue")
const waiterCurrentClient = document.getElementById("waiterCurrentClient")
const waiterQueue = document.getElementById("waiterQueue")
const workerScale = Number.parseFloat(
  getComputedStyle(document.documentElement).getPropertyValue("--worker-scale")
) || 1
const clientCardVisualWidth = 92 * workerScale

let state = {
  status: "paused",
  cashier: {
    doing: 3,
    queue: [4, 5, 6, 7, 8, 9]
  },
  kitchen: {
    doing: 1,
    queue: [2, 3, 4, 5, 6, 7, 8, 9, 10]
  },
  waiter: {
    doing: 1,
    queue: [2]
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

    case "pushed_to_kitchen_queue":
      handleKitchenQueuePushed(msg)
      break

    case "kitchen_queue_updated":
    case "popped_from_kitchen_queue":
      handleKitchenQueuePopped(msg)
      break

    case "kitchen_started_processing":
      handleKitchenStarted(msg)
      break

    case "kitchen_waiting":
      handleKitchenWaiting()
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
    },
    kitchen: {
      doing: msg.data?.kitchen?.doing ?? null,
      queue: msg.data?.kitchen?.queue ?? []
    },
    waiter: {
      doing: msg.data?.waiter?.doing ?? null,
      queue: msg.data?.waiter?.queue ?? []
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
  renderCashier()
}

function handleCashierQueuePopped(msg) {
  state.cashier.queue = msg.data.queue
  renderCashier()
}

function handleCashierStarted(msg) {
  state.cashier.doing = msg.data.entity_id
  renderCashier()
}

function handleCashierWaiting() {
  state.cashier.doing = null
  renderCashier()
}

function handleKitchenQueuePushed(msg) {
  state.kitchen.queue = msg.data.queue
  renderKitchen()
}

function handleKitchenQueuePopped(msg) {
  state.kitchen.queue = msg.data.queue
  renderKitchen()
}

function handleKitchenStarted(msg) {
  state.kitchen.doing = msg.data.entity_id
  renderKitchen()
}

function handleKitchenWaiting() {
  state.kitchen.doing = null
  renderKitchen()
}

function renderAll() {
  renderStatus()
  renderKitchen()
  renderCashier()
  renderWaiter()
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

  if (!state.cashier.queue.length) {
    cashierQueue.innerHTML = '<div class="client-card-empty">Очередь пуста</div>'
    return
  }

  cashierQueue.innerHTML = state.cashier.queue
    .map((clientId) => createClientCard(clientId))
    .join("")
}

function renderKitchen() {
  kitchenDoing.innerHTML = state.kitchen?.doing
    ? createTicketCard(state.kitchen.doing)
    : '<div class="ticket-card-empty">Нет тикета</div>'

  if (!state.kitchen?.queue?.length) {
    kitchenQueue.innerHTML = '<div class="ticket-card-empty">Очередь тикетов пуста</div>'
    return
  }

  kitchenQueue.innerHTML = state.kitchen.queue
    .map((ticketId) => createTicketCard(ticketId))
    .join("")
}

function renderWaiter() {
  waiterCurrentClient.innerHTML = state.waiter?.doing
    ? createClientCard(state.waiter.doing)
    : '<div class="client-card-empty">Нет клиента</div>'

  if (!state.waiter?.queue?.length) {
    waiterQueue.innerHTML = '<div class="client-card-empty">Очередь пуста</div>'
    return
  }

  waiterQueue.innerHTML = state.waiter.queue
    .map((clientId) => createClientCard(clientId))
    .join("")
}

function createClientCard(clientId) {
  return `
    <div class="client-card">
      <div class="client-card-number">#${clientId}</div>
      <img src="../static/images/client.svg" alt="Client #${clientId}">
    </div>
  `
}

function createTicketCard(ticketId) {
  return `
    <div class="ticket-card">
      <div class="ticket-card-number">#${ticketId}</div>
      <img src="../static/images/ticket.svg" alt="Ticket #${ticketId}">
    </div>
  `
}

function animateClientArrived() {
  if (!state.cashier) {
    state.cashier = { doing: null, queue: [] }
  }

  if (!Array.isArray(state.cashier.queue)) {
    state.cashier.queue = []
  }

  const queueNumbers = state.cashier.queue
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value))

  const doingNumber = Number(state.cashier.doing)
  const baseValue = queueNumbers.length
    ? queueNumbers[queueNumbers.length - 1]
    : (Number.isNaN(doingNumber) ? 0 : doingNumber)

  const nextClientId = baseValue + 1
  state.cashier.queue.push(nextClientId)

  const emptyState = cashierQueue.querySelector(".client-card-empty")
  if (emptyState) {
    emptyState.remove()
  }

  const wrapper = document.createElement("div")
  wrapper.innerHTML = createClientCard(nextClientId).trim()
  const clientCard = wrapper.firstElementChild

  if (!clientCard) {
    renderCashier()
    return nextClientId
  }

  clientCard.classList.add("client-card-arriving")
  cashierQueue.appendChild(clientCard)

  return nextClientId
}

function animateClientDoneWithCashier() {
  const currentClientId = state.cashier?.doing

  if (currentClientId === null || currentClientId === undefined) {
    return null
  }

  if (!state.waiter) {
    state.waiter = { doing: null, queue: [] }
  }

  if (!Array.isArray(state.waiter.queue)) {
    state.waiter.queue = []
  }

  if (!Array.isArray(state.cashier.queue)) {
    state.cashier.queue = []
  }

  const startCard = cashierCurrentClient.querySelector(".client-card")
  const targetContainer = waiterQueue

  state.waiter.queue.push(currentClientId)

  const nextCashierClient = state.cashier.queue.length ? state.cashier.queue.shift() : null
  state.cashier.doing = nextCashierClient

  if (!startCard || !targetContainer) {
    renderCashier()
    renderWaiter()
    return currentClientId
  }

  const startRect = startCard.getBoundingClientRect()
  const targetRect = getWaiterQueueTargetRect()

  const travelCard = startCard.cloneNode(true)
  travelCard.classList.remove("client-card-arriving")
  travelCard.classList.add("client-card-travel")
  travelCard.style.left = `${startRect.left}px`
  travelCard.style.top = `${startRect.top}px`
  travelCard.style.width = `${startRect.width}px`
  document.body.appendChild(travelCard)

  renderCashier()


  const deltaX = targetRect.left - startRect.left
  const deltaY = targetRect.top - startRect.top

  const animation = travelCard.animate(
    [
      {
        transform: "translate(0, 0) scale(1)",
        opacity: 1
      },
      {
        transform: `translate(${deltaX}px, ${deltaY}px) scale(0.96)`,
        opacity: 1
      }
    ],
    {
      duration: 3000,
      easing: "ease-in-out",
      fill: "forwards"
    }
  )

  animation.onfinish = () => {
    travelCard.remove()
    renderWaiter()
  }

  animation.oncancel = () => {
    travelCard.remove()
    renderWaiter()
  }

  return currentClientId
}

function getWaiterQueueTargetRect() {
  const emptyState = waiterQueue.querySelector(".client-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return {
      left: rect.left + (rect.width - clientCardVisualWidth) / 2,
      top: rect.top
    }
  }

  const cards = waiterQueue.querySelectorAll(".client-card")
  const lastCard = cards[cards.length - 1]

  if (!lastCard) {
    const rect = waiterQueue.getBoundingClientRect()
    return {
      left: rect.left + Math.max(0, rect.width / 2 - clientCardVisualWidth / 2),
      top: rect.top
    }
  }

  const rect = lastCard.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top
  }
}


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
window.animateClientArrived = animateClientArrived
window.animateClientDoneWithCashier = animateClientDoneWithCashier


renderCashier()
renderKitchen()
renderWaiter()
var millisecondsToWait = 5000;
setTimeout(function() {
    animateClientArrived()
}, 2000);

setTimeout(function() {
    animateClientDoneWithCashier()
}, 5000);
