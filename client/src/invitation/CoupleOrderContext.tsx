import { createContext, useContext, useState, type ReactNode } from "react";
import {
  defaultCoupleDisplayOrder,
  loadOrCreateCoupleDisplayOrder,
  type CoupleDisplayOrder
} from "./coupleOrder";

const CoupleOrderContext = createContext<CoupleDisplayOrder>(defaultCoupleDisplayOrder);

type CoupleOrderProviderProps = {
  children: ReactNode;
  initialOrder?: CoupleDisplayOrder;
};

export function CoupleOrderProvider({ children, initialOrder }: CoupleOrderProviderProps) {
  const [order] = useState(() => initialOrder ?? loadOrCreateCoupleDisplayOrder());

  return (
    <CoupleOrderContext.Provider value={order}>
      {children}
    </CoupleOrderContext.Provider>
  );
}

export function useCoupleOrder(): CoupleDisplayOrder {
  return useContext(CoupleOrderContext);
}
