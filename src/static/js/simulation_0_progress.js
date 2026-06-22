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

function syncWorkerProgressStatus(previousStatus, nextStatus) {
  if (previousStatus === nextStatus) {
    return
  }

  if (nextStatus === "paused") {
    pauseWorkerProgress("cashier")
    pauseWorkerProgress("kitchen")
    return
  }

  if (nextStatus === "running") {
    resumeWorkerProgress("cashier")
    resumeWorkerProgress("kitchen")
  }
}

function persistActiveProgressBeforeUnload() {
  pauseWaiterTravel()
  pauseWorkerProgress("cashier")
  pauseWorkerProgress("kitchen")
}

function restoreWorkerProgressState() {
  restoreWorkerProgress("cashier")
  restoreWorkerProgress("kitchen")
}

function restoreWorkerProgress(workerName) {
  const entityId = getWorkerDoingEntityId(workerName)

  if (!hasEntity(entityId)) {
    clearSavedWorkerProgress(workerName)
    return
  }

  if (state.status === "running") {
    resumeWorkerProgress(workerName)
    return
  }

  if (state.status === "paused" && getSavedWorkerProgress(workerName, entityId) === null) {
    clearSavedWorkerProgress(workerName)
  }
}

function pauseWorkerProgress(workerName) {
  const entityId = getWorkerDoingEntityId(workerName)

  if (!hasEntity(entityId)) {
    clearSavedWorkerProgress(workerName)
    return
  }

  const intervalMs = getWorkerIntervalMs(workerName)
  const savedProgress = getSavedWorkerProgress(workerName, entityId)
  const currentProgress = savedProgress ?? getWorkerProgressMs(state[`${workerName}_started_work_at`])
  const clampedProgress = Math.max(0, Math.min(currentProgress, intervalMs))

  persistWorkerProgress(workerName, entityId, clampedProgress)
}

function resumeWorkerProgress(workerName) {
  const entityId = getWorkerDoingEntityId(workerName)

  if (!hasEntity(entityId)) {
    clearSavedWorkerProgress(workerName)
    return
  }

  const savedProgress = getSavedWorkerProgress(workerName, entityId)

  if (savedProgress === null) {
    return
  }

  const intervalMs = getWorkerIntervalMs(workerName)
  const clampedProgress = Math.max(0, Math.min(savedProgress, intervalMs))
  state[`${workerName}_started_work_at`] = new Date(Date.now() - clampedProgress).toISOString()
  clearSavedWorkerProgress(workerName)
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
      const fallbackProgress = getSavedWaiterProgress(currentOrderId) ?? getWaiterProgressMs(state.waiter_started_work_at)
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
  travelCard.style.position = "absolute"
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

function getWorkerProgressState(workerName) {
  const intervalMs = getWorkerIntervalMs(workerName)
  const startedAt = state[`${workerName}_started_work_at`]
  const entityId = getWorkerDoingEntityId(workerName)
  const savedProgress = state.status === "paused"
    ? getSavedWorkerProgress(workerName, entityId)
    : null
  const progressMs = savedProgress ?? getWorkerProgressMs(startedAt)
  const clampedProgressMs = Math.max(0, Math.min(progressMs, intervalMs))
  const progressRatio = intervalMs > 0 ? clampedProgressMs / intervalMs : 1

  return {
    progressRatio,
    remainingMs: Math.max(0, intervalMs - clampedProgressMs),
    isRunning: state.status === "running"
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

function getWorkerDoingEntityId(workerName) {
  return state[workerName]?.doing
}

function persistWorkerProgress(workerName, entityId, progressMs) {
  const storageKey = workerProgressStorageKeys[workerName]

  if (!storageKey || !hasEntity(entityId)) {
    clearSavedWorkerProgress(workerName)
    return
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify({
      workerName,
      entityId,
      progressMs: Math.max(0, progressMs)
    }))
  } catch (error) {
    console.warn(`Failed to persist ${workerName} progress:`, error)
  }
}

function getSavedWorkerProgress(workerName, entityId) {
  const storageKey = workerProgressStorageKeys[workerName]

  if (!storageKey || !hasEntity(entityId)) {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (parsedValue?.workerName !== workerName || parsedValue?.entityId !== entityId) {
      return null
    }

    const progressMs = Number(parsedValue.progressMs)

    if (!Number.isFinite(progressMs) || progressMs < 0) {
      return null
    }

    return progressMs
  } catch (error) {
    console.warn(`Failed to read ${workerName} progress:`, error)
    return null
  }
}

function clearSavedWorkerProgress(workerName) {
  const storageKey = workerProgressStorageKeys[workerName]

  if (!storageKey) {
    return
  }

  try {
    window.localStorage.removeItem(storageKey)
  } catch (error) {
    console.warn(`Failed to clear ${workerName} progress:`, error)
  }
}

function getWorkerIntervalMs(workerName) {
  const rawValue = Number(state[`${workerName}_interval`])

  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 3000
  }

  return rawValue < 1000 ? rawValue * 1000 : rawValue
}

function getWorkerProgressMs(startedAtStr) {
  const startedAtMs = Date.parse(startedAtStr)

  if (Number.isNaN(startedAtMs)) {
    return 0
  }

  return Math.max(0, Date.now() - startedAtMs)
}
