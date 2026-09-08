console.log("SDLC Pod Runner started.");
console.log("Environment variables:", process.env);

// 기본 동작 후 종료되는 구조 (Job/Pod 형태)
setTimeout(() => {
  console.log("SDLC Pod Runner finished.");
  process.exit(0);
}, 5000);
