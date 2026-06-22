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
  cashierCurrentClient.innerHTML = hasEntity(state.cashier.doing)
    ? createClientCard(state.cashier.doing, { progress: getWorkerProgressState("cashier") })
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
  kitchenDoing.innerHTML = hasEntity(state.kitchen?.doing)
    ? createTicketCard(state.kitchen.doing, { progress: getWorkerProgressState("kitchen") })
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

  waiterCurrentClient.innerHTML = hasEntity(currentWaiterClientId)
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

function createClientCard(clientId, options = {}) {
  return `
    <div class="client-card">
      ${createWorkerProgressBar(options.progress)}
      <div class="client-card-number">#${clientId}</div>
      <img src="../static/images/client.svg" alt="Client #${clientId}">
    </div>
  `
}

function createTicketCard(ticketId, options = {}) {
  return `
    <div class="ticket-card">
      ${createWorkerProgressBar(options.progress)}
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

  if (Array.isArray(state.waiter?.queue)) {
    state.waiter.queue.forEach(enqueueClientId)
  }

  if (Array.isArray(state.kitchen?.queue)) {
    state.kitchen.queue.forEach(enqueueClientId)
  }

  enqueueClientId(state.kitchen?.doing)

  return waitingClientIds.sort(compareEntityIdsAscending)
}

function compareEntityIdsAscending(leftId, rightId) {
  const leftNumber = Number(leftId)
  const rightNumber = Number(rightId)

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber
  }

  return String(leftId).localeCompare(String(rightId), "ru", { numeric: true })
}

function hasEntity(entityId) {
  return entityId !== null && entityId !== undefined
}

function updateWorkerIntervalState(workerName, interval) {

  switch (workerName) {
    case "cashier":
      state.cashier_interval = interval
      break

    case "kitchen":
      state.kitchen_interval = interval
      break

    case "waiter":
      state.waiter_interval = interval
      break

    default:
      console.warn("Unknown worker interval:", workerName)
  }
}

function createWorkerProgressBar(progress) {
  if (!progress) {
    return ""
  }

  const progressRatio = Math.max(0, Math.min(1, progress.progressRatio))
  const remainingMs = Math.max(0, Number(progress.remainingMs) || 0)
  const runningClass = progress.isRunning && remainingMs > 0
    ? " worker-progress-fill-running"
    : ""

  return `
      <div class="worker-progress-pipe" aria-hidden="true">
        <div
          class="worker-progress-fill${runningClass}"
          style="--worker-progress-start: ${progressRatio}; --worker-progress-remaining: ${remainingMs}ms;"
        ></div>
      </div>`
}

function removeWorkerProgressBar(card) {
  card.querySelector(".worker-progress-pipe")?.remove()
}

function setWaiterWorkerImage(isInWork) {
  if (!waiterWorkerImage) {
    return
  }

  waiterWorkerImage.src = isInWork ? waiterInWorkImageSrc : waiterIdleImageSrc
}
