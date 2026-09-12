# Karoline Cabeleireira

MVP mobile em Expo + React Native + Supabase.

## Funcionalidades

- Um único app para Gestor e Cliente.
- Login por e-mail + senha, com confirmação por e-mail no cadastro. O celular é usado no perfil do cliente.
- Gestor: clientes, profissionais, serviços, vouchers, novidades, solicitações, agenda e caixa.
- Cliente: cadastro, serviços ativos sem preço, solicitação, agenda, novidades e fidelidade.
- WhatsApp do salão: +55 12 99258-8955.
- Fidelidade: pontos automáticos ao concluir atendimento; recompensas configuráveis pelo Gestor.

## Usuários e clientes

Na aba `Clientes`, o Gestor pode cadastrar, editar e excluir cadastros do salão. A conta de login continua sendo administrada pelo Supabase Auth. Para criar ou excluir usuários de autenticação, não coloque a chave `service_role` no aplicativo; use o painel do Supabase ou uma Edge Function protegida.

## Supabase

1. Execute `supabase/schema.sql` no SQL Editor.
2. Em `Authentication > Providers > Email`, ative o provedor Email e mantenha `Confirm email` ativado. O cadastro enviará um link de confirmação para o e-mail informado.
3. No projeto, use URL e Publishable Key no `.env`.

`.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
```

## Gestor

Crie a conta pelo app, confirme o e-mail e depois, no SQL Editor, promova exatamente o e-mail usado no cadastro:

```sql
update public.profiles
set role = 'manager'
where id = (
  select id
  from auth.users
  where lower(email) = lower('SEU_EMAIL_DE_GESTOR@exemplo.com')
);

select p.id, u.email, p.full_name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('SEU_EMAIL_DE_GESTOR@exemplo.com');
```

O resultado da consulta precisa mostrar `role = manager`. Depois faça logout no app e entre novamente com esse mesmo e-mail.

## Rodar

```bash
npm install
npx expo start -c
```

No celular, abra o Expo Go e leia o QR Code.
