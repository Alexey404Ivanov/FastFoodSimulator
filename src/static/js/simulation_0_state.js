const simulationId = Number(window.simulationId)
const payloadStorageKey = `simulation:${simulationId}:payload`
const sessionStartedKey = `simulation:${simulationId}:started`
const waiterProgressStorageKey = `simulation:${simulationId}:waiter-progress`
const workerProgressStorageKeys = {
  cashier: `simulation:${simulationId}:cashier-progress`,
  kitchen: `simulation:${simulationId}:kitchen-progress`
}
const settingsLastUpdatedStorageKey = `simulation:${simulationId}:settings-last-updated`
const settingsUpdateCooldownMs = 15000
const toastLifetimeMs = 3000
const intervalMinSeconds = 5
const intervalMaxSeconds = 45
const intervalRangeErrorMessage = "Только значения от 5 до 45 включительно"

const continueButton = document.getElementById("continueButton")
const stopButton = document.getElementById("pauseButton")
const simulationSettingsButton = document.getElementById("simulationSettingsButton")
const simulationSettingsModal = document.getElementById("simulationSettingsModal")
const simulationSettingsForm = document.getElementById("simulationSettingsForm")
const simulationSettingsCloseButton = document.getElementById("simulationSettingsCloseButton")
const simulationSettingsSubmitButton = document.getElementById("simulationSettingsSubmitButton")
const simulationSettingsError = document.getElementById("simulationSettingsError")
const intervalInputs = {
  client: document.getElementById("clientIntervalInput"),
  cashier: document.getElementById("cashierIntervalInput"),
  kitchen: document.getElementById("kitchenIntervalInput"),
  waiter: document.getElementById("waiterIntervalInput")
}
const toastStack = document.getElementById("toastStack")
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
  cashier_started_work_at: null,
  kitchen_started_work_at: null,
  waiter_started_work_at: null,

  cashier_interval: null,
  kitchen_interval: null,
  waiter_interval: null,

  worked_time: null,
  started_at: null
}
