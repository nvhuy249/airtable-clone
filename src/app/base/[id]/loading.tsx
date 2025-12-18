"use client";

import React from "react";
import BaseClient from "./BaseClient";

export default function BaseLoading() {
  return (
    <BaseClient
      baseId="loading"
      baseName="Loading…"
      tables={[]}
      user={{ id: "loading", name: null, email: null, image: null }}
      loading
    />
  );
}
