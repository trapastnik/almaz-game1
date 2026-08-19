import type { Metadata } from "next";
import { GameApp } from "./GameApp";

export const metadata: Metadata = {
  title: "Вредно-полезно",
  description: "Интерактивная игра о полезных привычках питания",
};

export default function Home() {
  return <GameApp />;
}
