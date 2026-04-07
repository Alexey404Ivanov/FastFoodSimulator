const simulationForm = document.getElementById("simulationForm");

simulationForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(simulationForm);
    const values = Object.fromEntries(formData.entries());

    console.log("Simulation form data:", values);
});