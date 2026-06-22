function getDocumentPoint(rect, width = 0) {
  return {
    left: rect.left + window.scrollX + width,
    top: rect.top + window.scrollY
  }
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
  const startLeft = startRect.left + window.scrollX + (startRect.width - ticketCardVisualWidth) / 2
  const startTop = startRect.top + window.scrollY - 28 * workerScale

  travelCard.style.position = "absolute"
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
  const startPoint = getDocumentPoint(startRect)

  const travelCard = startCard.cloneNode(true)
  removeWorkerProgressBar(travelCard)
  travelCard.classList.remove("client-card-arriving")
  travelCard.classList.add("client-card-travel")
  travelCard.style.position = "absolute"
  travelCard.style.left = `${startPoint.left}px`
  travelCard.style.top = `${startPoint.top}px`
  travelCard.style.width = `${startRect.width}px`
  renderCashier()
  waiterClientQueue.innerHTML = queueBeforeNewClient.length
    ? queueBeforeNewClient.map((clientId) => createClientCard(clientId)).join("")
    : '<div class="client-card-empty">Очередь клиентов пуста</div>'
  document.body.appendChild(travelCard)


  const deltaX = targetRect.left - startPoint.left
  const deltaY = targetRect.top - startPoint.top

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
  const startPoint = getDocumentPoint(startRect)

  const travelCard = startCard.cloneNode(true)
  travelCard.classList.remove("client-card-arriving")
  travelCard.classList.add("client-card-travel")
  travelCard.style.position = "absolute"
  travelCard.style.left = `${startPoint.left}px`
  travelCard.style.top = `${startPoint.top}px`
  travelCard.style.width = `${startRect.width}px`
  cashierCurrentClient.innerHTML = '<div class="client-card-empty">Нет клиента</div>'
  cashierQueue.innerHTML = state.cashier.queue.length
    ? state.cashier.queue.map((clientId) => createClientCard(clientId)).join("")
    : '<div class="client-card-empty">Очередь пуста</div>'
  document.body.appendChild(travelCard)

  const deltaX = targetRect.left - startPoint.left
  const deltaY = targetRect.top - startPoint.top

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
  const startPoint = getDocumentPoint(startRect)

  const travelCard = startCard.cloneNode(true)
  travelCard.style.position = "absolute"
  travelCard.style.zIndex = "20"
  travelCard.style.pointerEvents = "none"
  travelCard.style.margin = "0"
  travelCard.style.left = `${startPoint.left}px`
  travelCard.style.top = `${startPoint.top}px`
  travelCard.style.width = `${startRect.width}px`

  kitchenDoing.innerHTML = '<div class="ticket-card-empty">Нет текущего заказа</div>'
  kitchenQueue.innerHTML = state.kitchen.queue.length
    ? state.kitchen.queue.map((ticketId) => createTicketCard(ticketId)).join("")
    : '<div class="ticket-card-empty">Очередь заказов пуста</div>'

  document.body.appendChild(travelCard)

  const deltaX = targetRect.left - startPoint.left
  const deltaY = targetRect.top - startPoint.top

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

  removeWorkerProgressBar(travelCard)

  const startRect = kitchenWorkerImage.getBoundingClientRect()
  const targetRect = getWaiterBurgerQueueTargetRect()
  const queueBeforeNewBurger = state.waiter.queue.slice(0, -1)
  const startLeft = startRect.left + window.scrollX + (startRect.width - burgerCardVisualWidth) / 2
  const startTop = startRect.top + window.scrollY + startRect.height - 16 * workerScale

  travelCard.style.position = "absolute"
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
  travelCard.style.position = "absolute"
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
    return getDocumentPoint(rect)
  }

  const emptyState = cashierCurrentClient.querySelector(".client-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return getDocumentPoint(rect, (rect.width - clientCardVisualWidth) / 2)
  }

  const rect = cashierCurrentClient.getBoundingClientRect()
  return getDocumentPoint(rect, Math.max(0, rect.width / 2 - clientCardVisualWidth / 2))
}

function getKitchenQueueTargetRect() {
  const cards = kitchenQueue.querySelectorAll(".ticket-card")
  const lastCard = cards[cards.length - 1]

  if (lastCard) {
    const rect = lastCard.getBoundingClientRect()
    return getDocumentPoint(rect)
  }

  const emptyState = kitchenQueue.querySelector(".ticket-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return getDocumentPoint(rect, (rect.width - ticketCardVisualWidth) / 2)
  }

  const rect = kitchenQueue.getBoundingClientRect()
  return getDocumentPoint(rect, Math.max(0, rect.width / 2 - ticketCardVisualWidth / 2))
}

function getKitchenDoingTargetRect() {
  const emptyState = kitchenDoing.querySelector(".ticket-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return getDocumentPoint(rect, (rect.width - ticketCardVisualWidth) / 2)
  }

  const rect = kitchenDoing.getBoundingClientRect()
  return getDocumentPoint(rect, Math.max(0, rect.width / 2 - ticketCardVisualWidth / 2))
}

function getWaiterCurrentClientTargetRect() {
  const existingCard = waiterCurrentClient.querySelector(".client-card")
  if (existingCard) {
    const rect = existingCard.getBoundingClientRect()
    return getDocumentPoint(rect)
  }

  const emptyState = waiterCurrentClient.querySelector(".client-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return getDocumentPoint(rect, (rect.width - clientCardVisualWidth) / 2)
  }

  const rect = waiterCurrentClient.getBoundingClientRect()
  return getDocumentPoint(rect, Math.max(0, rect.width / 2 - clientCardVisualWidth / 2))
}

function getWaiterStandTargetRect() {
  const rect = waiterCurrentClient.getBoundingClientRect()
  return getDocumentPoint(
    {
      left: rect.left,
      top: rect.top - 72 * workerScale
    },
    Math.max(0, rect.width / 2 - waiterTravelVisualWidth / 2)
  )
}

function getWaiterDeliveryStartRect() {
  if (waiterTableImage) {
    const rect = waiterTableImage.getBoundingClientRect()
    return getDocumentPoint(
      {
        left: rect.left + rect.width * 0.58 - waiterTravelVisualWidth / 2,
        top: rect.top - 24 * workerScale
      }
    )
  }

  if (waiterWorkerImage) {
    const rect = waiterWorkerImage.getBoundingClientRect()
    return getDocumentPoint(
      {
        left: rect.left + rect.width / 2 - waiterTravelVisualWidth / 2,
        top: rect.top + rect.height / 2 - waiterTravelVisualWidth / 2
      }
    )
  }

  const rect = waiterBurgerQueue.getBoundingClientRect()
  return getDocumentPoint(rect, Math.max(0, rect.width / 2 - waiterTravelVisualWidth / 2))
}

function getWaiterBurgerQueueTargetRect() {
  const emptyState = waiterBurgerQueue.querySelector(".burger-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return getDocumentPoint(rect, (rect.width - burgerCardVisualWidth) / 2)
  }

  const cards = waiterBurgerQueue.querySelectorAll(".burger-card")
  const lastCard = cards[cards.length - 1]

  if (!lastCard) {
    const rect = waiterBurgerQueue.getBoundingClientRect()
    return getDocumentPoint(rect, Math.max(0, rect.width / 2 - burgerCardVisualWidth / 2))
  }

  const rect = lastCard.getBoundingClientRect()
  return getDocumentPoint(rect)
}

function getWaiterClientQueueTargetRect() {
  const emptyState = waiterClientQueue.querySelector(".client-card-empty")
  if (emptyState) {
    const rect = emptyState.getBoundingClientRect()
    return getDocumentPoint(rect, (rect.width - clientCardVisualWidth) / 2)
  }

  const cards = waiterClientQueue.querySelectorAll(".client-card")
  const lastCard = cards[cards.length - 1]

  if (!lastCard) {
    const rect = waiterClientQueue.getBoundingClientRect()
    return getDocumentPoint(rect, Math.max(0, rect.width / 2 - clientCardVisualWidth / 2))
  }

  const rect = lastCard.getBoundingClientRect()
  return getDocumentPoint(rect)
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

