async function updateSimulationStatus(action) {
  const endpoint = `/api/simulation/${simulationId}/${action}`

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

async function openSimulationSettingsModal() {
  if (!simulationSettingsModal) {
    return
  }

  if (isSettingsUpdateCooldownActive()) {
    showToast("Обновлять настройки можно раз в 15 секунд")
    return
  }

  setSimulationSettingsError("")
  setSimulationSettingsLoading(true, "Загрузка...")
  simulationSettingsModal.hidden = false

  try {
    const response = await fetch(`/api/simulation/${simulationId}/settings`)

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const settings = await response.json()
    fillSimulationSettingsForm(settings)
  } catch (error) {
    console.error("Failed to load simulation settings:", error)
    setSimulationSettingsError("Не удалось загрузить текущие настройки")
  } finally {
    setSimulationSettingsLoading(false)
    intervalInputs.client?.focus()
  }
}

function closeSimulationSettingsModal() {
  if (!simulationSettingsModal) {
    return
  }

  simulationSettingsModal.hidden = true
  setSimulationSettingsError("")
}

function isSimulationSettingsModalOpen() {
  return Boolean(simulationSettingsModal && !simulationSettingsModal.hidden)
}

function fillSimulationSettingsForm(settings) {
  setIntervalInputValue("client", settings?.client_interval)
  setIntervalInputValue("cashier", settings?.cashier_interval)
  setIntervalInputValue("kitchen", settings?.kitchen_interval)
  setIntervalInputValue("waiter", settings?.waiter_interval)
}

function setIntervalInputValue(workerName, value) {
  const input = intervalInputs[workerName]

  if (!input) {
    return
  }

  input.value = value ?? ""
}

async function submitSimulationSettings() {
  if (!simulationSettingsForm) {
    return
  }

  setSimulationSettingsError("")

  const workers = Object.entries(intervalInputs).map(([name, input]) => ({
    name,
    interval: Number(input.value)
  }))

  if (
    workers.some((worker) => (
      !Number.isFinite(worker.interval) ||
      worker.interval < intervalMinSeconds ||
      worker.interval > intervalMaxSeconds
    ))
  ) {
    setSimulationSettingsError(intervalRangeErrorMessage)
    return
  }

  if (!simulationSettingsForm.reportValidity()) {
    return
  }

  setSimulationSettingsLoading(true, "Сохранение...")

  try {
    const response = await fetch(`/api/simulation/${simulationId}/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ workers })
    })

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    workers.forEach((worker) => {
      updateWorkerIntervalState(worker.name, worker.interval)
    })
    persistSettingsLastUpdatedAt(Date.now())
    closeSimulationSettingsModal()
    renderCashier()
    renderKitchen()
  } catch (error) {
    console.error("Failed to update simulation settings:", error)
    setSimulationSettingsError("Не удалось сохранить настройки")
  } finally {
    setSimulationSettingsLoading(false)
  }
}

function setSimulationSettingsLoading(isLoading, submitText = "Применить изменения") {
  if (simulationSettingsButton) {
    simulationSettingsButton.disabled = isLoading
  }

  if (simulationSettingsSubmitButton) {
    simulationSettingsSubmitButton.disabled = isLoading
    simulationSettingsSubmitButton.textContent = isLoading ? submitText : "Применить изменения"
  }

  Object.values(intervalInputs).forEach((input) => {
    if (input) {
      input.disabled = isLoading
    }
  })
}

function setSimulationSettingsError(message) {
  if (simulationSettingsError) {
    simulationSettingsError.textContent = message
  }
}

function isSettingsUpdateCooldownActive() {
  const lastUpdatedAt = getSettingsLastUpdatedAt()

  if (lastUpdatedAt === null) {
    return false
  }

  return Date.now() - lastUpdatedAt <= settingsUpdateCooldownMs
}

function getSettingsLastUpdatedAt() {
  try {
    const rawValue = window.localStorage.getItem(settingsLastUpdatedStorageKey)
    const parsedValue = Number(rawValue)

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return null
    }

    return parsedValue
  } catch (error) {
    console.warn("Failed to read settings cooldown:", error)
    return null
  }
}

function persistSettingsLastUpdatedAt(updatedAt) {
  try {
    window.localStorage.setItem(settingsLastUpdatedStorageKey, String(updatedAt))
  } catch (error) {
    console.warn("Failed to persist settings cooldown:", error)
  }
}

function showToast(message) {
  if (!toastStack) {
    return
  }

  const toast = document.createElement("div")
  toast.className = "toast-notification"
  toast.textContent = message
  toastStack.appendChild(toast)

  window.setTimeout(() => {
    toast.classList.add("toast-notification-removing")

    window.setTimeout(() => {
      toast.remove()
    }, 240)
  }, toastLifetimeMs)
}
