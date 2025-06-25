## Playwright Test Automation Framework

This repository contains the **Playwright Test Automation Framework** for Comcorp instances, built using **Playwright** and **TypeScript**. Designed with **scalability**, **security**, and **maintainability** in mind, it supports end-to-end **UI**, **API**, and **database** test automation.

### Key Features

- ✅ **Persistent authentication** to eliminate redundant login steps
- ⚡ **Faster test execution** through optimized login and state reuse
- 🛡️ **Secure and reliable** coverage of protected routes and flows
- 🔁 **Modular, reusable components** for scalable test development
- 🌐 **Auto-resolves configurations** for CI/CD and local environments
- 🔗 **Integrated testing** across UI, services, and database layers

Perfect for enterprise-grade automation that demands **robust**, **secure**, and **consistent** validation across multiple environments.

---

## Getting Started

Ensure **Node.js** is installed. Then, install dependencies:

```bash
npm install
```

---

## Test Configuration

Before executing any tests, make sure to update the configuration located at:

```
src/config/testConfig/appMetadata.config.ts
```

Update the following fields:

- **`version`**:
  The current version of the application under test (e.g., `"1.0.0"`).
  If not specified, it defaults to `undefined`.

- **`platform`**:
  The environment/platform the tests are running on (e.g., `"Windows"`, `"Linux"`).
  Default: `"Windows"`.

- **`testType`**:
  The type of test being executed (e.g., `"sanity"`, `"regression"`).
  Default: `sanity | regression`.

> ⚠️ These values influence test behavior, logging, and reporting. Ensure they are accurate before running tests.

---
