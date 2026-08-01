import type { District, LocationOption, Mandal, State } from "@/lib/types";
import { TELANGANA } from "@/constants/telangana";
import { ANDHRA_PRADESH } from "@/constants/andhraPradesh";
import { UTTARAKHAND } from "@/constants/uttarakhand";

export type { District, LocationOption, Mandal, State as StateData };

export const STATES: State[] = [TELANGANA, ANDHRA_PRADESH, UTTARAKHAND];

function getState(id: string): State | undefined {
  return STATES.find((s) => s.id === id);
}

function getDistrict(stateId: string, districtId: string): District | undefined {
  return getState(stateId)?.districts.find((d) => d.id === districtId);
}

function getMandal(stateId: string, districtId: string, mandalId: string): Mandal | undefined {
  return getDistrict(stateId, districtId)?.mandals.find(
    (m) => m.id === mandalId,
  );
}

export const getStates = () => STATES;

export function getDistricts(stateId: string) {
  return getState(stateId)?.districts ?? [];
}

export function getMandals(stateId: string, districtId: string) {
  return getDistrict(stateId, districtId)?.mandals ?? [];
}

export const getStateName = (id: string) => getState(id)?.label;

export const getDistrictName = (stateId: string, districtId: string) =>
  getDistrict(stateId, districtId)?.label;

export const getMandalName = (
  stateId: string,
  districtId: string,
  mandalId: string,
) => getMandal(stateId, districtId, mandalId)?.label;

export function getLocationLabel(
  stateId?: string,
  districtId?: string,
  mandalId?: string,
) {
  return [
    mandalId && districtId && stateId
      ? getMandalName(stateId, districtId, mandalId)
      : undefined,

    districtId && stateId ? getDistrictName(stateId, districtId) : undefined,

    stateId ? getStateName(stateId) : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}
