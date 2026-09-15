"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; import { Provider } from "react-redux"; import { useState } from "react"; import { store } from "../src/store";
export function AppProviders({children}:{children:React.ReactNode}){const [client]=useState(()=>new QueryClient()); return <Provider store={store}><QueryClientProvider client={client}>{children}</QueryClientProvider></Provider>;}
