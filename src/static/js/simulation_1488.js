const simulationId = 1488
const payloadStorageKey = `simulation:${simulationId}:payload`
const sessionStartedKey = `simulation:${simulationId}:started`
const waiterProgressStorageKey = `simulation:${simulationId}:waiter-progress`

const continueButton = document.getElementById("continueButton")
const stopButton = document.getElementById("pauseButton")
const timerDisplay = document.querySelector(".timer-display")
const kitchenDoing = document.getElementById("kitchenDoing")
const kitchenQueue = document.getElementById("kitchenQueue")
const kitchenWorkerImage = document.querySelector(".worker-node-root > img")
const cashierWorkerImage = document.querySelector(".worker-node-cashier > img")
const waiterWorkerImage = document.querySelector(".worker-node-waiter > img")
const cashierCurrentClient = document.getElementById("cashierCurrentClient")
const cashierQueue = document.getElementById("cashierQueue")
const waiterCurrentClient = document.getElementById("waiterCurrentClient")
const waiterClientQueue = document.getElementById("waiterClientQueue")
const waiterBurgerQueue = document.getElementById("waiterBurgerQueue")
const waiterTableImage = document.querySelector(".waiter-table-node > img")
const workerScale = Number.parseFloat(
  getComputedStyle(document.documentElement).getPropertyValue("--worker-scale")
) || 1
const clientCardVisualWidth = 92 * workerScale
const ticketCardVisualWidth = 92 * workerScale
const burgerCardVisualWidth = 92 * workerScale
const waiterTravelVisualWidth = 118 * workerScale
const waiterIdleImageSrc = "../static/images/workers/waiter.svg"
const waiterInWorkImageSrc = "../static/images/workers/waiter_in_work.svg"
let waiterClientQueueState = []
let timerIntervalId = null
let waiterTravelState = {
  entityId: null,
  card: null,
  animation: null,
  progressMs: 0
}

let state = {
  status: "paused",
  cashier: {
    doing: null,
    queue: []
  },
  kitchen: {
    doing: null,
    queue: []
  },
  waiter: {
    doing: null,
    queue: []
  },
  waiter_started_work_time: null,
  waiter_interval: null,
  worked_time: null,
  started_at: null
}

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

if (continueButton) {
  continueButton.addEventListener("click", () => {
    void updateSimulationStatus("continue")
  })
}

if (stopButton) {
  stopButton.addEventListener("click", () => {
    void updateSimulationStatus("pause")
  })
}

window.addEventListener("beforeunload", () => {
  if (state.status === "paused") {
    pauseWaiterTravel()
  }
})

function handleEvent(msg) {
  switch (msg.type) {
    case "init":
      handleInit(msg)
      break

    case "simulation_status_updated":
      handleStatusUpdated(msg)
      break

    case "worker_queue_pushed":
      handleWorkerQueuePushed(msg.data)
      break

    case "worker_started_job":
      handleWorkerStartedJob(msg.data)
      break

    case "worker_finished_job":
      handleWorkerFinishedJob(msg.data)
      break

    default:
      console.warn("Unknown event:", msg)
  }
}

async function updateSimulationStatus(action) {
  const endpoint = `/api/simulation/${action}`

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    })

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }
  } catch (error) {
    console.error(`Failed to ${action} simulation:`, error)
  }
}

function handleWorkerQueuePushed(data) {
  switch (data.worker_name) {
    case "cashier":
      handleCashierQueuePushed(data.entity_id)
      break

    case "kitchen":
      handleKitchenQueuePushed(data.entity_id)
      break

    case "waiter":
      handleWaiterQueuePushed(data.entity_id)
      break

    default:
      console.warn("Unknown worker queue pushed event:", data)
  }
}

function handleCashierQueuePushed(entity_id) {
  state.cashier.queue.push(entity_id)
  animateClientArrived(entity_id)
}

function handleKitchenQueuePushed(entity_id) {
  if (!Array.isArray(state.kitchen.queue)) {
    state.kitchen.queue = []
  }

  state.kitchen.queue.push(entity_id)
  animateCreatedNewOrder(entity_id)
}

function handleWaiterQueuePushed(entity_id) {
  state.waiter.queue.push(entity_id)
  animateOrderDone(entity_id)
}


function handleWorkerStartedJob(data) {
  switch (data.worker_name) {
    case "cashier":
      handleCashierStartedJob()
      break

    case "kitchen":
      handleKitchenStartedJob()
      break

    case "waiter":
      handleWaiterStartedJob(data.waiter_started_work_at)
      break

    default:
      console.warn("Unknown event:", msg)
  }
}

function handleCashierStartedJob() {
  const nextClientId = state.cashier.queue.shift()
  state.cashier.doing = nextClientId
  animateCashierStartedJob(nextClientId)
}

function handleKitchenStartedJob() {
  if (!Array.isArray(state.kitchen.queue) || !state.kitchen.queue.length) {
    return
  }

  const nextTicketId = state.kitchen.queue.shift()
  state.kitchen.doing = nextTicketId
  animateKitchenStartedJob(nextTicketId)
}

function handleWaiterStartedJob(started_at) {
  const nextOrderId = state.waiter.queue.shift()

  if (nextOrderId === null || nextOrderId === undefined) {
    return
  }

  state.waiter.doing = nextOrderId
  state.waiter_started_work_time = started_at ?? state.waiter_started_work_time

  const savedProgress = getSavedWaiterProgress(nextOrderId)
  const progress = savedProgress ?? getWaiterProgressMs(state.waiter_started_work_time)
  renderWaiter()
  animateWaiterGoToClient(nextOrderId, progress)
}

function handleWorkerFinishedJob(data) {
  switch (data.worker_name) {
    case "cashier":
      handleCashierFinishedJob()
      break

    case "kitchen":
      handleKitchenFinishedJob()
      break

    case "waiter":
      handleWaiterFinishedJob()
      break

    default:
      console.warn("Unknown event:", msg)
  }
}

function handleCashierFinishedJob() {
  const finishedClientId = state.cashier?.doing

  if (finishedClientId === null || finishedClientId === undefined) {
    return
  }

  state.cashier.doing = null
  animateClientDoneWithCashier(finishedClientId)
}

function handleKitchenFinishedJob() {
  const finishedTicketId = state.kitchen?.doing

  if (finishedTicketId === null || finishedTicketId === undefined) {
    return
  }

  state.kitchen.doing = null
  renderKitchen()
}

function handleWaiterFinishedJob() {
  const finishedOrderId = state.waiter?.doing

  if (finishedOrderId === null || finishedOrderId === undefined) {
    return
  }

  clearWaiterTravelState()
  clearSavedWaiterProgress()
  state.waiter.doing = null
  state.waiter_started_work_time = null
  setWaiterWorkerImage(false)
  renderWaiter()
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
    },
    waiter_started_work_time: msg.data?.waiter_started_work_time ?? null,
    waiter_interval: msg.data?.waiter_interval ?? null,
    worked_time: msg.data?.worked_time ?? null,
    started_at: msg.data?.started_at ?? null
  }
  waiterClientQueueState = buildWaiterClientQueueStateFromState()
  console.log(state)

  renderAll()
  syncTimerState()
  restoreWaiterTravelState()

  if (
    state.status === "running" &&
    state.waiter?.doing !== null &&
    state.waiter?.doing !== undefined &&
    state.waiter_started_work_time
  ) {
    animateWaiterGoToClient(
      state.waiter.doing,
      getSavedWaiterProgress(state.waiter.doing) ?? getWaiterProgressMs(state.waiter_started_work_time)
    )
  }
}

function handleStatusUpdated(msg) {
  const previousStatus = state.status
  const nextStatus = msg.data.status
  state.status = nextStatus
  state.worked_time = msg.data?.worked_time ?? state.worked_time
  state.started_at = msg.data?.started_at ?? state.started_at
  renderStatus()
  syncTimerState()
  syncWaiterTravelStatus(previousStatus, nextStatus)
}

function renderAll() {
  renderStatus()
  renderKitchen()
  renderCashier()
  renderWaiter()
}

function renderStatus() {
  if (continueButton) {
    const isDisabled = state.status === "running"
    continueButton.disabled = isDisabled
    continueButton.setAttribute("aria-disabled", String(isDisabled))
  }

  if (stopButton) {
    const isDisabled = state.status !== "running"
    stopButton.disabled = isDisabled
    stopButton.setAttribute("aria-disabled", String(isDisabled))
  }
}

function syncTimerState() {
  stopTimer()

  if (state.status === "running") {
    renderTimer(getCurrentWorkedTimeSeconds())
    startTimer()
    return
  }

  renderTimer(getStoredWorkedTimeSeconds())
}

function startTimer() {
  if (timerIntervalId !== null) {
    return
  }

  timerIntervalId = window.setInterval(() => {
    renderTimer(getCurrentWorkedTimeSeconds())
  }, 1000)
}

function stopTimer() {
  if (timerIntervalId === null) {
    return
  }

  window.clearInterval(timerIntervalId)
  timerIntervalId = null
}

function getCurrentWorkedTimeSeconds() {
  const storedWorkedTimeSeconds = getStoredWorkedTimeSeconds()

  if (state.status !== "running") {
    return storedWorkedTimeSeconds
  }

  const startedAtMs = Date.parse(state.started_at)

  if (Number.isNaN(startedAtMs)) {
    return storedWorkedTimeSeconds
  }

  return storedWorkedTimeSeconds + Math.max(0, (Date.now() - startedAtMs) / 1000)
}

function getStoredWorkedTimeSeconds() {
  const workedTimeSeconds = Number(state.worked_time)

  if (!Number.isFinite(workedTimeSeconds) || workedTimeSeconds < 0) {
    return 0
  }

  return workedTimeSeconds
}

function renderTimer(totalWorkedTimeSeconds) {
  if (!timerDisplay) {
    return
  }

  timerDisplay.textContent = `Время работы симуляции: ${formatWorkedTime(totalWorkedTimeSeconds)}`
}

function formatWorkedTime(totalWorkedTimeSeconds) {
  const safeSeconds = Math.max(0, totalWorkedTimeSeconds)
  const totalSeconds = Math.floor(safeSeconds)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, "0")}.${String(seconds).padStart(2, "0")}`
}

function syncWaiterTravelStatus(previousStatus, nextStatus) {
  if (previousStatus === nextStatus) {
    return
  }

  if (nextStatus === "paused") {
    pauseWaiterTravel()
    return
  }

  if (nextStatus === "running") {
    resumeWaiterTravel()
  }
}

function restoreWaiterTravelState() {
  clearWaiterTravelState()

  const currentOrderId = state.waiter?.doing

  if (currentOrderId === null || currentOrderId === undefined) {
    clearSavedWaiterProgress()
    return
  }

  if (state.status === "paused") {
    const savedProgress = getSavedWaiterProgress(currentOrderId)

    if (savedProgress !== null) {
      renderPausedWaiterTravel(currentOrderId, savedProgress)
    }
  }
}

function pauseWaiterTravel() {
  if (!waiterTravelState.card) {
    const currentOrderId = state.waiter?.doing

    if (currentOrderId !== null && currentOrderId !== undefined) {
      const fallbackProgress = getSavedWaiterProgress(currentOrderId) ?? getWaiterProgressMs(state.waiter_started_work_time)
      renderPausedWaiterTravel(currentOrderId, fallbackProgress)
    }

    return
  }

  if (waiterTravelState.animation) {
    waiterTravelState.animation.pause()
  }

  waiterTravelState.progressMs = getCurrentWaiterTravelProgress()
  persistWaiterTravelProgress(waiterTravelState.entityId, waiterTravelState.progressMs)
}

function resumeWaiterTravel() {
  const currentOrderId = state.waiter?.doing

  if (currentOrderId === null || currentOrderId === undefined) {
    clearWaiterTravelState()
    clearSavedWaiterProgress()
    return
  }

  if (
    waiterTravelState.card &&
    waiterTravelState.animation &&
    waiterTravelState.entityId === currentOrderId
  ) {
    waiterTravelState.animation.play()
    clearSavedWaiterProgress()
    return
  }

  const savedProgress = getSavedWaiterProgress(currentOrderId)

  if (savedProgress !== null) {
    animateWaiterGoToClient(currentOrderId, savedProgress)
    clearSavedWaiterProgress()
  }
}

function getCurrentWaiterTravelProgress() {
  if (!waiterTravelState.animation) {
    return Math.max(0, waiterTravelState.progressMs || 0)
  }

  const currentTime = Number(waiterTravelState.animation.currentTime)

  if (!Number.isFinite(currentTime)) {
    return Math.max(0, waiterTravelState.progressMs || 0)
  }

  return Math.max(0, currentTime)
}

function persistWaiterTravelProgress(entityId, progressMs) {
  if (entityId === null || entityId === undefined) {
    clearSavedWaiterProgress()
    return
  }

  try {
    window.localStorage.setItem(waiterProgressStorageKey, JSON.stringify({
      entityId,
      progressMs: Math.max(0, progressMs)
    }))
  } catch (error) {
    console.warn("Failed to persist waiter progress:", error)
  }
}

function getSavedWaiterProgress(entityId) {
  if (entityId === null || entityId === undefined) {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(waiterProgressStorageKey)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (parsedValue?.entityId !== entityId) {
      return null
    }

    const progressMs = Number(parsedValue.progressMs)

    if (!Number.isFinite(progressMs) || progressMs < 0) {
      return null
    }

    return progressMs
  } catch (error) {
    console.warn("Failed to read waiter progress:", error)
    return null
  }
}

function clearSavedWaiterProgress() {
  try {
    window.localStorage.removeItem(waiterProgressStorageKey)
  } catch (error) {
    console.warn("Failed to clear waiter progress:", error)
  }
}

function clearWaiterTravelState() {
  if (waiterTravelState.animation) {
    waiterTravelState.animation.onfinish = null
    waiterTravelState.animation.oncancel = null
    waiterTravelState.animation.cancel()
  }

  if (waiterTravelState.card) {
    waiterTravelState.card.remove()
  }

  waiterTravelState = {
    entityId: null,
    card: null,
    animation: null,
    progressMs: 0
  }
}

function renderPausedWaiterTravel(entity_id, progress = 0) {
  const waiterIntervalMs = getWaiterIntervalMs()
  const clampedProgress = Math.max(0, Math.min(progress, waiterIntervalMs))
  const wrapper = document.createElement("div")
  wrapper.innerHTML = createWaiterTravelCard(entity_id).trim()
  const travelCard = wrapper.firstElementChild

  if (!travelCard) {
    return entity_id
  }

  clearWaiterTravelState()

  const position = getWaiterTravelPosition(clampedProgress, waiterIntervalMs)
  setWaiterWorkerImage(true)
  travelCard.style.left = `${position.left}px`
  travelCard.style.top = `${position.top}px`
  travelCard.style.width = `${waiterTravelVisualWidth}px`
  document.body.appendChild(travelCard)

  waiterTravelState = {
    entityId: entity_id,
    card: travelCard,
    animation: null,
    progressMs: clampedProgress
  }

  persistWaiterTravelProgress(entity_id, clampedProgress)
  return entity_id
}

function renderCashier() {
  cashierCurrentClient.innerHTML = state.cashier.doing
    ? createClientCard(state.cashier.doing)
    : '<div class="client-card-empty">Нет текущего клиента</div>'

  if (!state.cashier.queue.length) {
    cashierQueue.innerHTML = '<div class="client-card-empty">Очередь клиентов пуста</div>'
    return
  }

  cashierQueue.innerHTML = state.cashier.queue
    .map((clientId) => createClientCard(clientId))
    .join("")
}

function renderKitchen() {
  kitchenDoing.innerHTML = state.kitchen?.doing
    ? createTicketCard(state.kitchen.doing)
    : '<div class="ticket-card-empty">Нет текущего заказа</div>'

  if (!state.kitchen?.queue?.length) {
    kitchenQueue.innerHTML = '<div class="ticket-card-empty">Очередь заказов пуста</div>'
    return
  }

  kitchenQueue.innerHTML = state.kitchen.queue
    .map((ticketId) => createTicketCard(ticketId))
    .join("")
}

function renderWaiter() {
  const currentWaiterClientId = getWaiterVisibleClientId()

  waiterCurrentClient.innerHTML = currentWaiterClientId
    ? createClientCard(currentWaiterClientId)
    : '<div class="client-card-empty">Нет текущего клиента</div>'

  if (!state.waiter?.queue?.length) {
    waiterBurgerQueue.innerHTML = '<div class="burger-card-empty">Очередь выдачи пуста</div>'
  } else {
    waiterBurgerQueue.innerHTML = state.waiter.queue
      .map((orderId) => createBurgerCard(orderId))
      .join("")
  }

  renderWaiterClientQueue()
}

function renderWaiterClientQueue() {
  const currentWaiterClientId = getWaiterVisibleClientId()
  const visibleQueue = getWaiterQueuedClients(currentWaiterClientId)

  if (!visibleQueue.length) {
    waiterClientQueue.innerHTML = '<div class="client-card-empty">Очередь клиентов пуста</div>'
    return
  }

  waiterClientQueue.innerHTML = visibleQueue
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

function createBurgerCard(orderId) {
  return `
    <div class="burger-card">
      <div class="burger-card-number">#${orderId}</div>
      <img src="../static/images/burger.svg" alt="Burger #${orderId}">
    </div>
  `
}

function createWaiterTravelCard(orderId) {
  return `
    <div class="waiter-travel-card">
      <img src="../static/images/waiter_with_burger.svg" alt="Waiter with burger #${orderId}">
    </div>
  `
}

function animateClientArrived(entity_id) {
  if (!state.cashier) {
    state.cashier = { doing: null, queue: [] }
  }

  if (!Array.isArray(state.cashier.queue)) {
    state.cashier.queue = []
  }

  const nextClientId = entity_id

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

function animateCreatedNewOrder(entity_id) {
  const wrapper = document.createElement("div")
  wrapper.innerHTML = createTicketCard(entity_id).trim()
  const travelCard = wrapper.firstElementChild

  if (!travelCard || !cashierWorkerImage) {
    renderKitchen()
    return entity_id
  }

  const startRect = cashierWorkerImage.getBoundingClientRect()
  const targetRect = getKitchenQueueTargetRect()
  const queueBeforeNewTicket = state.kitchen.queue.slice(0, -1)
  const startLeft = startRect.left + (startRect.width - ticketCardVisualWidth) / 2
  const startTop = startRect.top - 28 * workerScale

  travelCard.style.position = "fixed"
  travelCard.style.zIndex = "20"
  travelCard.style.pointerEvents = "none"
  travelCard.style.margin = "0"
  travelCard.style.left = `${startLeft}px`
  travelCard.style.top = `${startTop}px`
  travelCard.style.width = `${ticketCardVisualWidth}px`

  kitchenQueue.innerHTML = queueBeforeNewTicket.length
    ? queueBeforeNewTicket.map((ticketId) => createTicketCard(ticketId)).join("")
    : '<div class="ticket-card-empty">Очередь заказов пуста</div>'

  document.body.appendChild(travelCard)

  const deltaX = targetRect.left - startLeft
  const deltaY = targetRect.top - startTop

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
    renderKitchen()
  }

  animation.oncancel = () => {
    travelCard.remove()
    renderKitchen()
  }

  return entity_id
}

function animateClientDoneWithCashier(entity_id) {
  const currentClientId = entity_id

  if (currentClientId === null || currentClientId === undefined) {
    return null
  }

  const startCard = cashierCurrentClient.querySelector(".client-card")

  if (!startCard) {
    renderCashier()
    return currentClientId
  }

  const startRect = startCard.getBoundingClientRect()
  waiterClientQueueState.push(currentClientId)
  const targetRect = getWaiterClientQueueTargetRect()
  const queueBeforeNewClient = waiterClientQueueState.slice(0, -1)

  const travelCard = startCard.cloneNode(true)
  travelCard.classList.remove("client-card-arriving")
  travelCard.classList.add("client-card-travel")
  travelCard.style.left = `${startRect.left}px`
  travelCard.style.top = `${startRect.top}px`
  travelCard.style.width = `${startRect.width}px`
  renderCashier()
  waiterClientQueue.innerHTML = queueBeforeNewClient.length
    ? queueBeforeNewClient.map((clientId) => createClientCard(clientId)).join("")
    : '<div class="client-card-empty">Очередь клиентов пуста</div>'
  document.body.appendChild(travelCard)


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
    renderWaiterClientQueue()
  }

  animation.oncancel = () => {
    travelCard.remove()
    renderWaiterClientQueue()
  }

  return currentClientId
}

function animateCashierStartedJob(entity_id) {
  const queueCards = cashierQueue.querySelectorAll(".client-card")
  const startCard = queueCards[0]

  if (!startCard) {
    renderCashier()
    return entity_id
  }

  const startRect = startCard.getBoundingClientRect()
  const targetRect = getCashierCurrentClientTargetRect()

  const travelCard = startCard.cloneNode(true)
  travelCard.classList.remove("client-card-arriving")
  travelCard.classList.add("client-card-travel")
  travelCard.style.left = `${startRect.left}px`
  travelCard.style.top = `${startRect.top}px`
  travelCard.style.width = `${startRect.width}px`
  cashierCurrentClient.innerHTML = '<div class="client-card-empty">Нет клиента</div>'
  cashierQueue.innerHTML = state.cashier.queue.length
    ? state.cashier.queue.map((clientId) => createClientCard(clientId)).join("")
    : '<div class="client-card-empty">Очередь пуста</div>'
  document.body.appendChild(travelCard)

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
    renderCashier()
  }

  animation.oncancel = () => {
    travelCard.remove()
    renderCashier()
  }

  return entity_id
}

function animateKitchenStartedJob(entity_id) {
  const queueCards = kitchenQueue.querySelectorAll(".ticket-card")
  const startCard = queueCards[0]

  if (!startCard) {
    renderKitchen()
    return entity_id
  }

  const startRect = startCard.getBoundingClientRect()
  const targetRect = getKitchenDoingTargetRect()

  const travelCard = startCard.cloneNode(true)
  travelCard.style.position = "fixed"
  travelCard.style.zIndex = "20"
  travelCard.style.pointerEvents = "none"
  travelCard.style.margin = "0"
  travelCard.style.left = `${startRect.left}px`
  travelCard.style.top = `${startRect.top}px`
  travelCard.style.width = `${startRect.width}px`

  kitchenDoing.innerHTML = '<div class="ticket-card-empty">Нет текущего заказа</div>'
  kitchenQueue.innerHTML = state.kitchen.queue.length
    ? state.kitchen.queue.map((ticketId) => createTicketCard(ticketId)).join("")
    : '<div class="ticket-card-empty">Очередь заказов пуста</div>'

  document.body.appendChild(travelCard)

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
    renderKitchen()
  }

  animation.oncancel = () => {
    travelCard.remove()
    renderKitchen()
  }

  return entity_id
}

function animateOrderDone(entity_id) {
  const wrapper = document.createElement("div")
  wrapper.innerHTML = createBurgerCard(entity_id).trim()
  const travelCard = wrapper.firstElementChild

  if (!travelCard || !kitchenWorkerImage) {
    renderWaiter()
    return entity_id
  }

  const startRect = kitchenWorkerImage.getBoundingClientRect()
  const targetRect = getWaiterBurgerQueueTargetRect()
  const queueBeforeNewBurger = state.waiter.queue.slice(0, -1)
  const startLeft = startRect.left + (startRect.width - burgerCardVisualWidth) / 2
  const startTop = startRect.top + startRect.height - 16 * workerScale

  travelCard.style.position = "fixed"
  travelCard.style.zIndex = "20"
  travelCard.style.pointerEvents = "none"
  travelCard.style.margin = "0"
  travelCard.style.left = `${startLeft}px`
  travelCard.style.top = `${startTop}px`
  travelCard.style.width = `${burgerCardVisualWidth}px`

  waiterBurgerQueue.innerHTML = queueBeforeNewBurger.length
    ? queueBeforeNewBurger.map((orderId) => createBurgerCard(orderId)).join("")
    : '<div class="burger-card-empty">Очередь выдачи пуста</div>'

  document.body.appendChild(travelCard)

  const deltaX = targetRect.left - startLeft
  const deltaY = targetRect.top - startTop

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

  return entity_id
}

function animateWaiterGoToClient(entity_id, progress = 0) {
  const waiterIntervalMs = getWaiterIntervalMs()
  const clampedProgress = Math.max(0, Math.min(progress, waiterIntervalMs))
  const remainingDuration = Math.max(0, waiterIntervalMs - clampedProgress)
  const wrapper = document.createElement("div")
  wrapper.innerHTML = createWaiterTravelCard(entity_id).trim()
  const travelCard = wrapper.firstElementChild

  if (!travelCard || !waiterCurrentClient) {
    return entity_id
  }

  clearWaiterTravelState()

  const { left: startLeft, top: startTop, targetLeft, targetTop } = getWaiterTravelPosition(
    clampedProgress,
    waiterIntervalMs
  )

  setWaiterWorkerImage(true)
  travelCard.style.left = `${startLeft}px`
  travelCard.style.top = `${startTop}px`
  travelCard.style.width = `${waiterTravelVisualWidth}px`
  document.body.appendChild(travelCard)

  waiterTravelState = {
    entityId: entity_id,
    card: travelCard,
    animation: null,
    progressMs: clampedProgress
  }

  if (remainingDuration <= 0) {
    clearSavedWaiterProgress()
    travelCard.remove()
    waiterTravelState.card = null
    setWaiterWorkerImage(false)
    removeWaiterClientFromQueue(entity_id)
    renderWaiter()
    return entity_id
  }

  const deltaX = targetLeft - startLeft
  const deltaY = targetTop - startTop

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
      duration: remainingDuration,
      easing: "ease-in-out",
      fill: "forwards"
    }
  )

  waiterTravelState.animation = animation

  animation.onfinish = () => {
    clearSavedWaiterProgress()
    travelCard.remove()
    waiterTravelState.card = null
    waiterTravelState.animation = null
    waiterTravelState.progressMs = waiterIntervalMs
    setWaiterWorkerImage(false)
    removeWaiterClientFromQueue(entity_id)
    renderWaiter()
  }

  animation.oncancel = () => {
    travelCard.remove()

    if (state.status !== "paused") {
      setWaiterWorkerImage(false)
      renderWaiter()
    }
  }

  return entity_id
}

function getWaiterTravelPosition(progressMs, waiterIntervalMs = getWaiterIntervalMs()) {
  const routeStartRect = getWaiterDeliveryStartRect()
  const targetRect = getWaiterStandTargetRect()
  const fullDeltaX = targetRect.left - routeStartRect.left
  const fullDeltaY = targetRect.top - routeStartRect.top
  const progressRatio = waiterIntervalMs > 0 ? progressMs / waiterIntervalMs : 1

  return {
    left: routeStartRect.left + fullDeltaX * progressRatio,
    top: routeStartRect.top + fullDeltaY * progressRatio,
    targetLeft: targetRect.left,
    targetTop: targetRect.top
  }
}

function getCashierCurrentClientTargetRect() {
  const existingCard = cashierCurrentClient.querySelector(".client-card")
  if (existingCard) {
    const rect = existingCard.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top
    }
  }

  const emptyState = cashierCurrentClient.querySelector(".client-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return {
      left: rect.left + (rect.width - clientCardVisualWidth) / 2,
      top: rect.top
    }
  }

  const rect = cashierCurrentClient.getBoundingClientRect()
  return {
    left: rect.left + Math.max(0, rect.width / 2 - clientCardVisualWidth / 2),
    top: rect.top
  }
}

function getKitchenQueueTargetRect() {
  const cards = kitchenQueue.querySelectorAll(".ticket-card")
  const lastCard = cards[cards.length - 1]

  if (lastCard) {
    const rect = lastCard.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top
    }
  }

  const emptyState = kitchenQueue.querySelector(".ticket-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return {
      left: rect.left + (rect.width - ticketCardVisualWidth) / 2,
      top: rect.top
    }
  }

  const rect = kitchenQueue.getBoundingClientRect()
  return {
    left: rect.left + Math.max(0, rect.width / 2 - ticketCardVisualWidth / 2),
    top: rect.top
  }
}

function getKitchenDoingTargetRect() {
  const emptyState = kitchenDoing.querySelector(".ticket-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return {
      left: rect.left + (rect.width - ticketCardVisualWidth) / 2,
      top: rect.top
    }
  }

  const rect = kitchenDoing.getBoundingClientRect()
  return {
    left: rect.left + Math.max(0, rect.width / 2 - ticketCardVisualWidth / 2),
    top: rect.top
  }
}

function getWaiterCurrentClientTargetRect() {
  const existingCard = waiterCurrentClient.querySelector(".client-card")
  if (existingCard) {
    const rect = existingCard.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top
    }
  }

  const emptyState = waiterCurrentClient.querySelector(".client-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return {
      left: rect.left + (rect.width - clientCardVisualWidth) / 2,
      top: rect.top
    }
  }

  const rect = waiterCurrentClient.getBoundingClientRect()
  return {
    left: rect.left + Math.max(0, rect.width / 2 - clientCardVisualWidth / 2),
    top: rect.top
  }
}

function getWaiterStandTargetRect() {
  const rect = waiterCurrentClient.getBoundingClientRect()
  return {
    left: rect.left + Math.max(0, rect.width / 2 - waiterTravelVisualWidth / 2),
    top: rect.top - 72 * workerScale
  }
}

function getWaiterDeliveryStartRect() {
  if (waiterTableImage) {
    const rect = waiterTableImage.getBoundingClientRect()
    return {
      left: rect.left + rect.width * 0.58 - waiterTravelVisualWidth / 2,
      top: rect.top - 24 * workerScale
    }
  }

  if (waiterWorkerImage) {
    const rect = waiterWorkerImage.getBoundingClientRect()
    return {
      left: rect.left + rect.width / 2 - waiterTravelVisualWidth / 2,
      top: rect.top + rect.height / 2 - waiterTravelVisualWidth / 2
    }
  }

  const rect = waiterBurgerQueue.getBoundingClientRect()
  return {
    left: rect.left + Math.max(0, rect.width / 2 - waiterTravelVisualWidth / 2),
    top: rect.top
  }
}

function getWaiterBurgerQueueTargetRect() {
  const emptyState = waiterBurgerQueue.querySelector(".burger-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return {
      left: rect.left + (rect.width - burgerCardVisualWidth) / 2,
      top: rect.top
    }
  }

  const cards = waiterBurgerQueue.querySelectorAll(".burger-card")
  const lastCard = cards[cards.length - 1]

  if (!lastCard) {
    const rect = waiterBurgerQueue.getBoundingClientRect()
    return {
      left: rect.left + Math.max(0, rect.width / 2 - burgerCardVisualWidth / 2),
      top: rect.top
    }
  }

  const rect = lastCard.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top
  }
}

function getWaiterClientQueueTargetRect() {
  const emptyState = waiterClientQueue.querySelector(".client-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return {
      left: rect.left + (rect.width - clientCardVisualWidth) / 2,
      top: rect.top
    }
  }

  const cards = waiterClientQueue.querySelectorAll(".client-card")
  const lastCard = cards[cards.length - 1]

  if (!lastCard) {
    const rect = waiterClientQueue.getBoundingClientRect()
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

function removeWaiterClientFromQueue(entity_id) {
  const clientIndex = waiterClientQueueState.indexOf(entity_id)

  if (clientIndex !== -1) {
    waiterClientQueueState.splice(clientIndex, 1)
    return
  }

  if (waiterClientQueueState.length) {
    waiterClientQueueState.shift()
  }
}

function getWaiterVisibleClientId() {
  if (state.waiter?.doing !== null && state.waiter?.doing !== undefined) {
    return state.waiter.doing
  }

  return null
}

function getWaiterQueuedClients(currentClientId) {
  const visibleQueue = waiterClientQueueState.slice()

  if (currentClientId === null || currentClientId === undefined) {
    return visibleQueue
  }

  const currentClientIndex = visibleQueue.indexOf(currentClientId)

  if (currentClientIndex !== -1) {
    visibleQueue.splice(currentClientIndex, 1)
  }

  return visibleQueue
}

function buildWaiterClientQueueStateFromState() {
  const waitingClientIds = []
  const currentWaiterClientId = state.waiter?.doing
  const enqueueClientId = (clientId) => {
    if (clientId === null || clientId === undefined) {
      return
    }

    if (clientId === currentWaiterClientId) {
      return
    }

    waitingClientIds.push(clientId)
  }

  enqueueClientId(state.kitchen?.doing)

  if (Array.isArray(state.kitchen?.queue)) {
    state.kitchen.queue.forEach(enqueueClientId)
  }

  if (Array.isArray(state.waiter?.queue)) {
    state.waiter.queue.forEach(enqueueClientId)
  }

  return waitingClientIds
}

function getWaiterIntervalMs() {
  const rawValue = Number(state.waiter_interval)

  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 3000
  }

  return rawValue < 1000 ? rawValue * 1000 : rawValue
}

function getWaiterProgressMs(startedAtStr) {
  const startedAtMs = Date.parse(startedAtStr)

  if (Number.isNaN(startedAtMs)) {
    return 0
  }

  return Math.max(0, Date.now() - startedAtMs)
}

function setWaiterWorkerImage(isInWork) {
  if (!waiterWorkerImage) {
    return
  }

  waiterWorkerImage.src = isInWork ? waiterInWorkImageSrc : waiterIdleImageSrc
}

window.debugState = () => console.log(state)
window.animateClientArrived = animateClientArrived
window.animateClientDoneWithCashier = animateClientDoneWithCashier
