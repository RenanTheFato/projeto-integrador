import { Decimal } from "@prisma/client/runtime/client";

export interface Base {
  id: string,
  name: string,
  address: string,
  latitude: Decimal,
  longitude: Decimal,
  phone: string,
  created_at: Date,
  updated_at: Date
}