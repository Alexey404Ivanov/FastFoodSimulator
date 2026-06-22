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

    case "worker_interval_updated":
      handleWorkerIntervalUpdated(msg.data)
      break

    default:
      console.warn("Unknown event:", msg)
  }
}

async function handleWorkerIntervalUpdated(data) {
  const workerName = data?.worker_name
  const newIntervalValue = data?.new_interval_value

  switch (workerName) {
    case "client":
      setIntervalInputValue("client", newIntervalValue)
      break

    case "cashier":
      state.cashier_interval = newIntervalValue
      setIntervalInputValue("cashier", newIntervalValue)
      renderCashier()
      break

    case "kitchen":
      state.kitchen_interval = newIntervalValue
      setIntervalInputValue("kitchen", newIntervalValue)
      renderKitchen()
      break

    case "waiter":
      state.waiter_interval = newIntervalValue
      setIntervalInputValue("waiter", newIntervalValue)
      if (state.waiter?.doing !== null && state.waiter?.doing !== undefined) {
        renderWaiter()
      }
      break

    default:
      console.warn("Unknown worker interval updated event:", data)
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
      handleCashierStartedJob(data.started_work_at)
      break

    case "kitchen":
      handleKitchenStartedJob(data.started_work_at)
      break

    case "waiter":
      handleWaiterStartedJob(data.started_work_at)
      break

    default:
      console.warn("Unknown worker started job event:", data)
  }
}

function handleCashierStartedJob(started_at) {
  const nextClientId = state.cashier.queue.shift()

  if (!hasEntity(nextClientId)) {
    return
  }

  clearSavedWorkerProgress("cashier")
  state.cashier.doing = nextClientId
  state.cashier_started_work_at = started_at ?? state.cashier_started_work_at
  animateCashierStartedJob(nextClientId)
}

function handleKitchenStartedJob(started_at) {
  if (!Array.isArray(state.kitchen.queue) || !state.kitchen.queue.length) {
    return
  }

  const nextTicketId = state.kitchen.queue.shift()
  clearSavedWorkerProgress("kitchen")
  state.kitchen.doing = nextTicketId
  state.kitchen_started_work_at = started_at ?? state.kitchen_started_work_at
  animateKitchenStartedJob(nextTicketId)
}

function handleWaiterStartedJob(started_at) {
  const nextOrderId = state.waiter.queue.shift()

  if (nextOrderId === null || nextOrderId === undefined) {
    return
  }

  state.waiter.doing = nextOrderId
  state.waiter_started_work_at = started_at ?? state.waiter_started_work_at

  const savedProgress = getSavedWaiterProgress(nextOrderId)
  const progress = savedProgress ?? getWaiterProgressMs(state.waiter_started_work_at)
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
      console.warn("Unknown worker finished job event:", data)
  }
}

function handleCashierFinishedJob() {
  const finishedClientId = state.cashier?.doing

  if (finishedClientId === null || finishedClientId === undefined) {
    return
  }

  state.cashier.doing = null
  state.cashier_started_work_at = null
  clearSavedWorkerProgress("cashier")
  animateClientDoneWithCashier(finishedClientId)
}

function handleKitchenFinishedJob() {
  const finishedTicketId = state.kitchen?.doing

  if (finishedTicketId === null || finishedTicketId === undefined) {
    return
  }

  state.kitchen.doing = null
  state.kitchen_started_work_at = null
  clearSavedWorkerProgress("kitchen")
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
  state.waiter_started_work_at = null
  setWaiterWorkerImage(false)
  renderWaiter()
  showToast(`Клиент #${finishedOrderId} ушел к обеденной зоне`)
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
    cashier_started_work_at: msg.data?.cashier_started_work_at ?? null,
    kitchen_started_work_at: msg.data?.kitchen_started_work_at ?? null,
    waiter_started_work_at: msg.data?.waiter_started_work_at ?? null,
    cashier_interval: msg.data?.cashier_interval ?? null,
    kitchen_interval: msg.data?.kitchen_interval ?? null,
    waiter_interval: msg.data?.waiter_interval ?? null,
    worked_time: msg.data?.worked_time ?? null,
    started_at: msg.data?.started_at ?? null
  }
  waiterClientQueueState = buildWaiterClientQueueStateFromState()
  restoreWorkerProgressState()
  console.log(state)

  renderAll()
  syncTimerState()
  restoreWaiterTravelState()

  if (
    state.status === "running" &&
    state.waiter?.doing !== null &&
    state.waiter?.doing !== undefined &&
    state.waiter_started_work_at
  ) {
    animateWaiterGoToClient(
      state.waiter.doing,
      getSavedWaiterProgress(state.waiter.doing) ?? getWaiterProgressMs(state.waiter_started_work_at)
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
  syncWorkerProgressStatus(previousStatus, nextStatus)
  renderCashier()
  renderKitchen()
}
