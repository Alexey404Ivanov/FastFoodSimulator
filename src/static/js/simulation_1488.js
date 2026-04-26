const simulationId = 1488

const ws = new WebSocket(
  `ws://localhost:50555/api/simulations/${simulationId}/events`
)

ws.onopen = () => {
  console.log("WS connected")
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log("WS message:", data)
}

ws.onclose = () => {
  console.log("WS closed")
}