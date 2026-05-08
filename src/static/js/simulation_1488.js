const simulationId = 1488
const payloadStorageKey = `simulation:${simulationId}:payload`
const sessionStartedKey = `simulation:${simulationId}:started`

const continueButton = document.getElementById("continueButton")
const stopButton = document.getElementById("pauseButton")
const timerDisplay = document.querySelector(".timer-display")
const kitchenDoing = document.getElementById("kitchenDoing")
const kitchenQueue = document.getElementById("kitchenQueue")
const cashierWorkerImage = document.querySelector(".worker-node-cashier > img")
const cashierCurrentClient = document.getElementById("cashierCurrentClient")
const cashierQueue = document.getElementById("cashierQueue")
const waiterCurrentClient = document.getElementById("waiterCurrentClient")
const waiterQueue = document.getElementById("waiterQueue")
const workerScale = Number.parseFloat(
  getComputedStyle(document.documentElement).getPropertyValue("--worker-scale")
) || 1
const clientCardVisualWidth = 92 * workerScale
const ticketCardVisualWidth = 92 * workerScale

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
  }
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
      handleWaiterStartedJob()
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

function handleWaiterStartedJob() {

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
  console.log(state)

  renderAll()
}

function handleStatusUpdated(msg) {
  const nextStatus = msg.data.status
  state.status = nextStatus
  renderStatus()
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
  waiterCurrentClient.innerHTML = state.waiter?.doing
    ? createClientCard(state.waiter.doing)
    : '<div class="client-card-empty">Нет текущего клиента</div>'

  if (!state.waiter?.queue?.length) {
    waiterQueue.innerHTML = '<div class="client-card-empty">Очередь клиентов на выдачу пуста</div>'
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

  if (!state.waiter.queue.includes(entity_id)) {
    state.waiter.queue.push(entity_id)
  }

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
  renderCashier()
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
    renderWaiter()
  }

  animation.oncancel = () => {
    travelCard.remove()
    renderWaiter()
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

window.debugState = () => console.log(state)
window.animateClientArrived = animateClientArrived
window.animateClientDoneWithCashier = animateClientDoneWithCashier
