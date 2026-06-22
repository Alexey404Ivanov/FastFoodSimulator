const simulationForm = document.getElementById("simulationForm");
const simulationFormError = document.getElementById("simulationFormError");
const intervalMinSeconds = 5;
const intervalMaxSeconds = 45;
const intervalRangeErrorMessage = "Только значения от 5 до 45 включительно";

simulationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setSimulationFormError("");

    const formData = new FormData(simulationForm);
    const values = Object.fromEntries(formData.entries());

    // Преобразуем строки в числа (важно!)
    const payload = {
        client_interval_seconds: Number(values.client_interval_seconds),
        cashier_interval_seconds: Number(values.cashier_interval_seconds),
        kitchen_interval_seconds: Number(values.kitchen_interval_seconds),
        waiter_interval_seconds: Number(values.waiter_interval_seconds),
    };

    const intervals = Object.values(payload);

    if (
        intervals.some((interval) => (
            !Number.isFinite(interval) ||
            interval < intervalMinSeconds ||
            interval > intervalMaxSeconds
        ))
    ) {
        setSimulationFormError(intervalRangeErrorMessage);
        return;
    }

    if (!simulationForm.reportValidity()) {
        return;
    }

    console.log("Sending payload:", payload);

    try {
        const response = await fetch("/api/simulation/start", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json().catch(() => null);

        console.log("Server response:", data);

    } catch (error) {
        console.error("Request failed:", error);
    }

    window.location.href="/simulation/0"
});

function setSimulationFormError(message) {
    if (simulationFormError) {
        simulationFormError.textContent = message;
    }
}
