﻿const simulationForm = document.getElementById("simulationForm");

simulationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(simulationForm);
    const values = Object.fromEntries(formData.entries());

    // Преобразуем строки в числа (важно!)
    const payload = {
        client_interval_seconds: Number(values.client_interval_seconds),
        cashier_interval_seconds: Number(values.cashier_interval_seconds),
        kitchen_interval_seconds: Number(values.kitchen_interval_seconds),
        waiter_interval_seconds: Number(values.waiter_interval_seconds),
    };

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

    window.location.href="/simulation/1488"
});