"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@repo/shared-types";
import { api } from "../src/api";
import { setSession } from "../src/store";

type Mode = "login" | "register";

export default function Home() {
  const dispatch = useDispatch();
  const [mode, setMode] = useState<Mode>("login");

  const isLogin = mode === "login";
  const form = useForm<LoginInput | RegisterInput>({
    resolver: zodResolver(isLogin ? loginSchema : registerSchema),
    mode: "onSubmit",
  });

  const mutation = useMutation({
    mutationFn: async (data: LoginInput | RegisterInput) => {
      const { data: session } = await api.post(isLogin ? "/auth/login" : "/auth/register", data);
      return session;
    },
    onSuccess: (session) => {
      dispatch(setSession(session));
    },
  });

  return (
    <main style={{ maxWidth: 520, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>YayeTech Hotel</h1>
      <p>Week 1 identity foundation</p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button type="button" onClick={() => setMode("login")} disabled={isLogin}>
          Sign in
        </button>
        <button type="button" onClick={() => setMode("register")} disabled={!isLogin}>
          Create account
        </button>
      </div>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <p>
          <label>
            Full name
            <br />
            <input
              {...form.register("fullName")}
              type="text"
              placeholder="Jane Doe"
              disabled={isLogin}
            />
          </label>
        </p>
        <p>
          <label>
            Email
            <br />
            <input {...form.register("email")} type="email" placeholder="jane@example.com" />
          </label>
        </p>
        <p>
          <label>
            Password
            <br />
            <input {...form.register("password")} type="password" placeholder="At least 8 characters" />
          </label>
        </p>
        {Object.keys(form.formState.errors).length > 0 ? (
          <p>Please fix the highlighted fields and try again.</p>
        ) : null}
        <button disabled={mutation.isPending}>
          {mutation.isPending ? "Submitting..." : isLogin ? "Sign in" : "Create account"}
        </button>
        {mutation.isError ? <p>Something went wrong. Please try again.</p> : null}
        {mutation.isSuccess ? (
          <p>{isLogin ? "Signed in successfully." : "Account created successfully."}</p>
        ) : null}
      </form>
    </main>
  );
}
