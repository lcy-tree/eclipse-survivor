const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    include: ["server/**/*.test.js"],
    environment: "node"
  }
});
