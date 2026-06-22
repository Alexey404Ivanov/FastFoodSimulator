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

if (simulationSettingsButton) {
  simulationSettingsButton.addEventListener("click", () => {
    void openSimulationSettingsModal()
  })
}

if (simulationSettingsCloseButton) {
  simulationSettingsCloseButton.addEventListener("click", closeSimulationSettingsModal)
}

if (simulationSettingsModal) {
  simulationSettingsModal.addEventListener("click", (event) => {
    if (event.target === simulationSettingsModal) {
      closeSimulationSettingsModal()
    }
  })
}

if (simulationSettingsForm) {
  simulationSettingsForm.addEventListener("submit", (event) => {
    event.preventDefault()
    void submitSimulationSettings()
  })
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isSimulationSettingsModalOpen()) {
    closeSimulationSettingsModal()
  }
})

window.addEventListener("beforeunload", () => {
  persistActiveProgressBeforeUnload()
})

window.debugState = () => console.log(state)
window.animateClientArrived = animateClientArrived
window.animateClientDoneWithCashier = animateClientDoneWithCashier
