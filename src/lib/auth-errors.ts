/** Erros amigáveis sem expor respostas ou detalhes internos do provedor. */
export function authErrorMessage(code?: string): string {
  switch (code) {
    case "invalid_credentials": return "E-mail ou senha inválidos.";
    case "email_not_confirmed": return "Confirme seu e-mail antes de entrar.";
    case "weak_password": return "Escolha uma senha mais forte, com pelo menos 8 caracteres.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit": return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    case "signup_disabled": return "O cadastro está temporariamente indisponível.";
    case "user_already_exists": return "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.";
    default: return "Não foi possível concluir. Verifique sua conexão e tente novamente.";
  }
}
