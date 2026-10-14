import {
  activateEmergency,
  approveSniv,
  approveWorkCenter,
  cancelSniv,
  correctMuster,
  deactivateEmergency,
  denySniv,
  flagMuster,
  prepare,
  requestFamilyReview,
  returnSniv,
  submitFamily,
  submitMuster,
  submitSniv,
  saveSnivDraft,
  synchronize,
  verifyMuster,
} from '../domain/accountability';
import { prototypeIdentity, prototypeNfaas, prototypePush } from '../domain/ports';

/**
 * Application service used by the screen layer.
 * Screens do not call Navy systems directly.
 * NFAAS, push, and identity are mock ports until real interfaces are validated.
 */
export const accountabilityService = {
  activateEmergency,
  approveSniv,
  approveWorkCenter,
  cancelSniv,
  correctMuster,
  deactivateEmergency,
  denySniv,
  flagMuster,
  prepare,
  requestFamilyReview,
  returnSniv,
  saveSnivDraft,
  submitFamily,
  submitMuster,
  submitSniv,
  synchronize,
  verifyMuster,
  identity: prototypeIdentity,
  nfaas: prototypeNfaas,
  push: prototypePush,
};
