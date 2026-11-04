import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Título da página */
  titulo: string;
  /** Descrição curta do módulo */
  descricao: string;
  /** O que o módulo fará no futuro */
  recursosPlanejados: string[];
  /** Serviços externos de que o módulo dependerá (vazio = nenhum) */
  dependencias: string[];
  /** Etapa do roadmap em que o módulo deve ser construído (ver ARQUITETURA.md) */
  etapaPrevista: string;
};

export type DemoStat = { rotulo: string; valor: string; detalhe: string };
export type DemoProduct = { id: string; nome: string; categoria: string; plataforma: string; pontuacao: number };
export type DemoActivity = { id: string; texto: string; quando: string };
export type IntegrationState = { nome: string; descricao: string };
