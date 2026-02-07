document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const loginBtn = document.getElementById("loginBtn");
  const errorMsg = document.getElementById("errorMessage");
  loginBtn.disabled = true;
  document.querySelector(".btn-text").style.display = "none";
  document.querySelector(".btn-loading").style.display = "inline-flex";
  errorMsg.style.display = "none";
  const result = await authService.login(email, password);
  if (result.success) {
    window.location.href = authService.getDefaultPage(result.user.role);
  } else {
    errorMsg.textContent = result.message || "Identifiants incorrects";
    errorMsg.style.display = "block";
    loginBtn.disabled = false;
    document.querySelector(".btn-text").style.display = "inline";
    document.querySelector(".btn-loading").style.display = "none";
  }
});
document
  .getElementById("togglePassword")
  .addEventListener("click", function () {
    const passwordInput = document.getElementById("password");
    passwordInput.type =
      passwordInput.type === "password" ? "text" : "password";
  });
document.getElementById("forgotPassword").addEventListener("click", (e) => {
  e.preventDefault();
  alert("Contactez votre administrateur.");
});
