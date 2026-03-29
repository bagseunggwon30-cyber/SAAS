import { useState } from "react";

const storageKeys = {
  activated: "xg5000.console.activated",
  operator: "xg5000.console.operator",
};

export const useLicenseGate = () => {
  const [activated, setActivated] = useState(() => window.localStorage.getItem(storageKeys.activated) === "true");
  const [operator, setOperator] = useState(() => window.localStorage.getItem(storageKeys.operator) ?? "");
  const [licenseKey, setLicenseKey] = useState("FIELD-DEMO-001");

  const activateConsole = () => {
    window.localStorage.setItem(storageKeys.activated, "true");
    window.localStorage.setItem(storageKeys.operator, operator);
    setActivated(true);
  };

  return {
    activateConsole,
    activated,
    licenseKey,
    operator,
    setLicenseKey,
    setOperator,
  };
};
