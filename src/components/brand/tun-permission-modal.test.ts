/**
 * Compile-only test asserting TunPermissionProvider + useTunPermission
 * + TunPermissionModal exports and their public signatures (B2).
 */

import type { ReactNode } from "react";
import {
  TunPermissionProvider,
  useTunPermission,
  TunPermissionModal,
} from "./tun-permission-modal";

// Provider is a component accepting children.
const _provider: (props: { children: ReactNode }) => unknown =
  TunPermissionProvider;
void _provider;

// Consumer hook returns { requestPermission }.
const _hook: () => { requestPermission(): Promise<boolean> } = useTunPermission;
void _hook;

// Visual modal exists (exported for tests only; provider mounts the only
// in-app instance).
const _modal: (props: {
  open: boolean;
  onGrant: () => void;
  onSkip: () => void;
}) => unknown = TunPermissionModal;
void _modal;
