import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './src/lib/supabase'

const WHATSAPP = '5512992588955'

const COLORS = {
  bg: '#fff7fb',
  card: '#ffffff',
  primary: '#d84f93',
  primaryDark: '#a92f6c',
  text: '#3b2631',
  muted: '#7d6470',
  border: '#efd5e2',
  soft: '#fdebf4',
  soft2: '#fff1f7',
  success: '#188653',
  danger: '#c73535',
  gold: '#b58a42',
}

type Role = 'manager' | 'client'

type Tab =
  | 'home'
  | 'requests'
  | 'clients'
  | 'professionals'
  | 'services'
  | 'vouchers'
  | 'news'
  | 'cash'
  | 'loyalty'
  | 'request'
  | 'schedule'

type Profile = {
  id: string
  full_name: string
  phone: string | null
  role: Role
}

type Service = {
  id: string
  name: string
  price: number
  active: boolean
}

type Client = {
  id: string
  user_id: string | null
  full_name: string
  phone: string
  active: boolean
}

type Professional = {
  id: string
  name: string
  specialty: string
  active: boolean
}

type Reward = {
  id: string
  name: string
  description: string | null
  points_required: number
  bonus_value: number | null
  active: boolean
}

type LoyaltyTransaction = {
  id: string
  client_id: string
  request_id: string | null
  points: number
  kind: string
  description: string
  created_at: string
  expires_at: string | null
}

type LoyaltySetting = {
  id: number
  program_active?: boolean
  active?: boolean
  points_per_completed_service: number
  points_validity_days?: number
}

type RequestRow = {
  id: string
  client_id: string
  service_id: string
  status: string
  preferred_date: string | null
  notes: string | null
  voucher_code: string | null
  scheduled_at: string | null
  negotiated_price: number | null
  professional_id: string | null
  created_at: string
  service_name: string
  service_base_price: number
  client_name: string
  client_phone: string | null
  professional_name: string | null
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

function toSupabasePhone(phone: string) {
  const digits = normalizePhone(phone)

  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`
  }

  throw new Error(
    'Informe um celular válido com DDD. Exemplo: (12) 91234-5678.'
  )
}

function formatPhone(phone: string) {
  const digits = normalizePhone(phone).slice(0, 11)

  if (digits.length <= 2) {
    return digits ? `(${digits}` : ''
  }

  const area = digits.slice(0, 2)
  const number = digits.slice(2)

  if (number.length === 0) {
    return `(${area}) `
  }

  if (number[0] === '9') {
    return number.length <= 5
      ? `(${area}) ${number}`
      : `(${area}) ${number.slice(0, 5)}-${number.slice(5)}`
  }

  return number.length <= 4
    ? `(${area}) ${number}`
    : `(${area}) ${number.slice(0, 4)}-${number.slice(4)}`
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDateTime(value: string | null) {
  if (!value) return '-'

  const d = new Date(value)

  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString('pt-BR')
}

function authErrorMessage(error: any) {
  const message = String(error?.message || '')
  const lowerMessage = message.toLowerCase()

  if (
    lowerMessage.includes('invalid login credentials') ||
    lowerMessage.includes('invalid credentials')
  ) {
    return 'E-mail ou senha incorretos.'
  }

  if (
    lowerMessage.includes('email not confirmed') ||
    lowerMessage.includes('email_not_confirmed')
  ) {
    return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e confirme o cadastro.'
  }

  if (
    lowerMessage.includes('user already registered') ||
    lowerMessage.includes('already registered')
  ) {
    return 'Este e-mail já possui cadastro. Faça login.'
  }

  if (
    lowerMessage.includes('email provider') ||
    lowerMessage.includes('email signup is disabled')
  ) {
    return 'O cadastro por e-mail está desativado no Supabase. Ative o provedor Email em Authentication > Providers.'
  }

  return message || 'Não foi possível continuar.'
}

function playNotificationSound() {
  if (typeof window === 'undefined') return

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const context = new AudioContextClass()
    const start = context.currentTime
    const tones = [
      { frequency: 880, offset: 0 },
      { frequency: 660, offset: 0.28 },
      { frequency: 880, offset: 0.56 },
      { frequency: 660, offset: 0.84 },
    ]

    for (const tone of tones) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const toneStart = start + tone.offset
      oscillator.type = 'square'
      oscillator.frequency.value = tone.frequency
      gain.gain.setValueAtTime(0.0001, toneStart)
      gain.gain.exponentialRampToValueAtTime(0.45, toneStart + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.2)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(toneStart)
      oscillator.stop(toneStart + 0.2)
    }

    context.resume().catch(() => {})
    setTimeout(() => context.close(), 1400)
  } catch {}
}

function announceServiceRequest(clientName: string) {
  playNotificationSound()

  if (typeof window === 'undefined' || !window.speechSynthesis) return

  const utterance = new SpeechSynthesisUtterance(
    `É uma solicitação de serviço da ${clientName}.`
  )
  utterance.lang = 'pt-BR'
  utterance.rate = 0.95
  utterance.volume = 1
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
}: {
  title: string
  onPress: () => void
  secondary?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        danger && styles.buttonDanger,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.buttonSecondaryText,
          danger && styles.buttonDangerText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  )
}

function Field({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  secureTextEntry?: boolean
  keyboardType?: any
}) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#aa969f"
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
    />
  )
}

function PhoneField({
  value,
  onChangeText,
  placeholder = '(12) 91234-5678',
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
}) {
  return (
    <TextInput
      style={styles.input}
      value={formatPhone(value)}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#aa969f"
      keyboardType="phone-pad"
      maxLength={15}
    />
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

function SectionTitle({
  children,
  subtitle,
}: {
  children: React.ReactNode
  subtitle?: string
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{children}</Text>

      {subtitle ? (
        <Text style={styles.muted}>{subtitle}</Text>
      ) : null}
    </View>
  )
}

async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,phone,role')
    .eq('id', userId)
    .single()

  if (error) {
    throw error
  }

  return data as Profile
}

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  /*
   * Recupera a sessão salva.
   */
  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          throw error
        }

        if (!mounted) return

        setSession(data.session)
      } catch (error: any) {
        if (!mounted) return

        setSession(null)
        setProfile(null)
        setProfileError(
          error?.message ||
            'Não foi possível recuperar a sessão.'
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)

        if (!nextSession) {
          setProfile(null)
          setProfileError(null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  /*
   * Carrega o perfil depois que a sessão estiver disponível.
   * Isso evita o problema do aplicativo voltar para o login.
   */
  useEffect(() => {
    let cancelled = false

    async function loadCurrentProfile() {
      if (!session?.user?.id) {
        setProfile(null)
        setProfileLoading(false)
        setProfileError(null)
        return
      }

      setProfileLoading(true)
      setProfileError(null)

      try {
        const loadedProfile = await loadProfile(
          session.user.id
        )

        if (cancelled) return

        setProfile(loadedProfile)
      } catch (error: any) {
        if (cancelled) return

        setProfile(null)

        setProfileError(
          error?.message ||
            'Não foi possível carregar o perfil desta conta.'
        )
      } finally {
        if (!cancelled) {
          setProfileLoading(false)
        }
      }
    }

    loadCurrentProfile()

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.muted}>
          Carregando Karoline Cabeleireira...
        </Text>
      </View>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  if (profileLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.muted}>
          Carregando seu perfil...
        </Text>
      </View>
    )
  }

  /*
   * Sessão existe, mas o perfil não foi carregado.
   * Agora o aplicativo mostra o erro em vez de voltar silenciosamente para o login.
   */
  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.sectionTitle}>
          Não foi possível carregar o perfil
        </Text>

        <Text
          style={[
            styles.muted,
            {
              textAlign: 'center',
              marginTop: 10,
            },
          ]}
        >
          {profileError ||
            'A sessão foi criada, mas o perfil não foi localizado.'}
        </Text>

        <Button
          title="Tentar novamente"
          onPress={async () => {
            if (!session?.user?.id) return

            setProfileLoading(true)
            setProfileError(null)

            try {
              const loadedProfile = await loadProfile(
                session.user.id
              )

              setProfile(loadedProfile)
            } catch (error: any) {
              setProfileError(
                error?.message ||
                  'Erro ao carregar o perfil.'
              )
            } finally {
              setProfileLoading(false)
            }
          }}
        />

        <Button
          title="Sair"
          secondary
          onPress={async () => {
            await supabase.auth.signOut()
            setSession(null)
            setProfile(null)
          }}
        />
      </View>
    )
  }

  /*
   * Aqui é decidido o tipo de usuário.
   */
  return profile.role === 'manager' ? (
    <ManagerApp profile={profile} />
  ) : (
    <ClientApp profile={profile} />
  )
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>(
    'login'
  )

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function submit() {
    setBusy(true)
    setErrorMessage('')

    try {
      const normalized = normalizePhone(phone)
      const normalizedEmail = email.trim().toLowerCase()

      if (
        !normalizedEmail ||
        !normalizedEmail.includes('@')
      ) {
        throw new Error('Informe um e-mail válido.')
      }

      if (password.length < 6) {
        throw new Error(
          'A senha deve ter pelo menos 6 caracteres.'
        )
      }

      if (mode === 'login') {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })

        if (error) {
          throw error
        }

        if (!data.session) {
          throw new Error(
            'O login não criou uma sessão.'
          )
        }

        return
      }

      if (!name.trim()) {
        throw new Error('Informe seu nome completo.')
      }

      const supabasePhone =
        toSupabasePhone(normalized)

      if (password !== confirmPassword) {
        throw new Error(
          'As senhas não conferem.'
        )
      }

      const { data, error } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: name.trim(),
              phone: supabasePhone,
            },
          },
        })

      if (error) {
        throw error
      }

      if (!data.session) {
        Alert.alert(
          'Confirme seu e-mail',
          'Enviamos um link de confirmação para o e-mail informado. Confirme-o antes de entrar.'
        )
      } else {
        Alert.alert(
          'Cadastro realizado',
          'Sua conta foi criada.'
        )
      }

      setMode('login')
      setPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      const message = authErrorMessage(error)
      setErrorMessage(message)
      Alert.alert('Atenção', message)
    } finally {
      setBusy(false)
    }
  }

  async function recoverPassword() {
    const normalizedEmail =
      email.trim().toLowerCase()

    if (
      !normalizedEmail ||
      !normalizedEmail.includes('@')
    ) {
      return Alert.alert(
        'Atenção',
        'Informe seu e-mail para receber o link de recuperação.'
      )
    }

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        normalizedEmail
      )

    if (error) {
      Alert.alert('Erro', error.message)
    } else {
      Alert.alert(
        'E-mail enviado',
        'Confira sua caixa de entrada e siga o link para criar uma nova senha.'
      )
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.authContainer}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar style="dark" />

      <View style={styles.brandMark}>
        <Text style={styles.brandLetter}>K</Text>
      </View>

      <View style={styles.logoRow}>
        <RoseDecoration size={42} />

        <Text style={styles.logo}>
          Karoline
        </Text>

        <RoseDecoration size={42} />
      </View>

      <Text style={styles.logoTag}>
        Cabeleireira
      </Text>

      <Text style={styles.subtitle}>
        Beleza, cuidado e agendamento na palma da mão
      </Text>

      <Card>
        <Text style={styles.authTitle}>
          {mode === 'login'
            ? 'Entrar'
            : 'Criar conta'}
        </Text>

        {errorMessage ? (
          <Text style={styles.authError}>{errorMessage}</Text>
        ) : null}

        {mode === 'signup' && (
          <>
            <Text style={styles.label}>
              Nome completo
            </Text>

            <Field
              value={name}
              onChangeText={setName}
              placeholder="Digite seu nome completo"
            />
          </>
        )}

        <Text style={styles.label}>
          E-mail
        </Text>

        <Field
          value={email}
          onChangeText={setEmail}
          placeholder="seuemail@exemplo.com"
          keyboardType="email-address"
        />

        {mode === 'signup' && (
          <>
            <Text style={styles.label}>
              Celular
            </Text>

            <PhoneField
              value={phone}
              onChangeText={setPhone}
            />
          </>
        )}

        <Text style={styles.label}>
          Senha
        </Text>

        <Field
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo de 6 caracteres"
          secureTextEntry
        />

        {mode === 'login' ? (
          <Pressable onPress={recoverPassword}>
            <Text style={styles.link}>
              Esqueci minha senha
            </Text>
          </Pressable>
        ) : null}

        {mode === 'signup' && (
          <>
            <Text style={styles.label}>
              Confirmar senha
            </Text>

            <Field
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repita a senha"
              secureTextEntry
            />
          </>
        )}

        <Button
          title={
            busy
              ? 'Aguarde...'
              : mode === 'login'
              ? 'Entrar'
              : 'Criar conta'
          }
          onPress={submit}
          disabled={busy}
        />

        <Button
          secondary
          title={
            mode === 'login'
              ? 'Ainda não tenho cadastro'
              : 'Já tenho uma conta'
          }
          onPress={() =>
            setMode(
              mode === 'login'
                ? 'signup'
                : 'login'
            )
          }
        />

        <Pressable
          onPress={() =>
            Linking.openURL(
              `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
                'Olá, gostaria de agendar um atendimento na Karoline Cabeleireira.'
              )}`
            )
          }
        >
          <Text style={styles.link}>
            Agendar pelo WhatsApp
          </Text>
        </Pressable>
      </Card>
    </ScrollView>
  )
}

function RoseDecoration({
  size = 46,
}: {
  size?: number
}) {
  const petal = Math.max(8, size * 0.28)

  return (
    <View
      style={[
        styles.roseWrap,
        {
          width: size,
          height: size,
        },
      ]}
    >
      <View
        style={[
          styles.rosePetal,
          {
            width: petal,
            height: petal,
            borderRadius: petal / 2,
            top: size * 0.08,
            left: size * 0.36,
          },
        ]}
      />

      <View
        style={[
          styles.rosePetal,
          {
            width: petal,
            height: petal,
            borderRadius: petal / 2,
            top: size * 0.28,
            left: size * 0.60,
          },
        ]}
      />

      <View
        style={[
          styles.rosePetal,
          {
            width: petal,
            height: petal,
            borderRadius: petal / 2,
            top: size * 0.58,
            left: size * 0.45,
          },
        ]}
      />

      <View
        style={[
          styles.rosePetal,
          {
            width: petal,
            height: petal,
            borderRadius: petal / 2,
            top: size * 0.56,
            left: size * 0.17,
          },
        ]}
      />

      <View
        style={[
          styles.rosePetal,
          {
            width: petal,
            height: petal,
            borderRadius: petal / 2,
            top: size * 0.28,
            left: size * 0.04,
          },
        ]}
      />

      <View
        style={[
          styles.roseCenter,
          {
            width: petal * 0.92,
            height: petal * 0.92,
            borderRadius: petal / 2,
            top: size * 0.34,
            left: size * 0.38,
          },
        ]}
      />
    </View>
  )
}

function Header({
  title,
  subtitle,
  onLogout,
  onBack,
}: {
  title: string
  subtitle?: string
  onLogout: () => void
  onBack?: () => void
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBrandRow}>
        <RoseDecoration size={38} />

        <View style={{ flex: 1 }}>
          <Text style={styles.headerBrand}>
            Karoline
          </Text>

          <Text style={styles.headerTitle}>
            {title}
          </Text>

          <Text style={styles.headerSub}>
            {subtitle ||
              'Beleza e cuidado na palma da mão'}
          </Text>
        </View>
      </View>

      <View style={styles.headerActions}>
        {onBack ? (
          <Pressable onPress={onBack}>
            <Text style={styles.link}>
              Voltar
            </Text>
          </Pressable>
        ) : null}

        <Pressable onPress={onLogout}>
          <Text style={styles.link}>
            Sair
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

function BottomNav({
  tabs,
  active,
  setTab,
}: {
  tabs: Tab[]
  active: Tab
  setTab: (tab: Tab) => void
}) {
  const labels: Record<Tab, string> = {
    home: 'Início',
    requests: 'Solicitações',
    clients: 'Clientes',
    professionals: 'Profissionais',
    services: 'Serviços',
    vouchers: 'Vouchers',
    news: 'Novidades',
    cash: 'Caixa',
    loyalty: 'Fidelidade',
    request: 'Solicitar',
    schedule: 'Agenda',
  }

  return (
    <View style={styles.bottomNav}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bottomScroll}
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setTab(tab)}
            style={[
              styles.bottomItem,
              active === tab &&
                styles.bottomItemActive,
            ]}
          >
            <Text
              style={
                active === tab
                  ? styles.bottomTextActive
                  : styles.bottomText
              }
            >
              {labels[tab]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

function ManagerApp({
  profile,
}: {
  profile: Profile
}) {
  const [tab, setTab] =
    useState<Tab>('home')

  const [requestCount, setRequestCount] =
    useState(0)

  const [notificationText, setNotificationText] =
    useState('')

  const [audioEnabled, setAudioEnabled] =
    useState(false)

  const logout = () => {
    supabase.auth.signOut()
  }

  useEffect(() => {
    let timer: any

    let previousCount = 0
    let previousRequestId = ''
    let initialized = false

    const check = async () => {
      const [{ count }, { data: latestRows }] = await Promise.all([
        supabase
          .from('service_requests')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('status', 'new'),
        supabase
          .from('manager_service_requests')
          .select('id,client_name,service_name,status,created_at')
          .eq('status', 'new')
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      const nextCount = count || 0
      const latestRequest = latestRows?.[0]

      setRequestCount(nextCount)

      if (
        initialized &&
        latestRequest &&
        (nextCount > previousCount ||
          latestRequest.id !== previousRequestId)
      ) {
        const clientName = latestRequest.client_name || 'uma cliente'
        setNotificationText(
          `É uma solicitação de serviço da ${clientName}.`
        )

        try {
          Vibration.vibrate([
            0,
            300,
            150,
            300,
          ])
        } catch {}

        announceServiceRequest(clientName)
      }

      previousCount = nextCount
      previousRequestId = latestRequest?.id || ''
      initialized = true
    }

    check()

    timer = setInterval(
      check,
      10000
    )

    return () => clearInterval(timer)
  }, [])

  return (
    <View style={styles.screen}>
      <Header
        title="Painel do Gestor"
        subtitle={`Olá, ${
          profile.full_name.split(' ')[0]
        }`}
        onLogout={logout}
        onBack={
          tab !== 'home'
            ? () => setTab('home')
            : undefined
        }
      />

      {!audioEnabled ? (
        <Pressable
          style={styles.audioEnableBanner}
          onPress={() => {
            setAudioEnabled(true)
            announceServiceRequest('teste de áudio')
          }}
        >
          <Text style={styles.alertBannerTitle}>
            🔊 Ativar alerta sonoro
          </Text>
          <Text style={styles.alertBannerText}>
            Toque uma vez para ouvir o aviso quando chegar uma solicitação.
          </Text>
        </Pressable>
      ) : null}

      {notificationText ? (
        <Pressable
          style={styles.alertBanner}
          onPress={() => {
            setNotificationText('')
            setTab('requests')
          }}
        >
          <Text style={styles.alertBannerTitle}>
            🔔 Nova solicitação
          </Text>
          <Text style={styles.alertBannerText}>
            {notificationText}
          </Text>
        </Pressable>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.container}
      >
        {tab === 'home' && (
          <ManagerHome
            setTab={setTab}
            requestCount={requestCount}
          />
        )}

        {tab === 'requests' && (
          <ManagerRequests />
        )}

        {tab === 'clients' && (
          <CrudClients />
        )}

        {tab === 'professionals' && (
          <CrudProfessionals />
        )}

        {tab === 'services' && (
          <CrudServices />
        )}

        {tab === 'vouchers' && (
          <ManagerVouchersCloud />
        )}

        {tab === 'news' && <CrudNews />}

        {tab === 'cash' && <CashManager />}

        {tab === 'loyalty' && (
          <ManagerLoyaltyCloud />
        )}
      </ScrollView>

      <BottomNav
        tabs={[
          'home',
          'requests',
          'clients',
          'professionals',
          'services',
          'vouchers',
          'news',
          'cash',
          'loyalty',
        ]}
        active={tab}
        setTab={setTab}
      />
    </View>
  )
}

function ManagerHome({
  setTab,
  requestCount,
}: {
  setTab: (tab: Tab) => void
  requestCount: number
}) {
  return (
    <>
      <Card>
        <Text style={styles.sectionTitle}>
          Gestão do salão
        </Text>

        <Text style={styles.muted}>
          Clientes, profissionais, serviços,
          agenda, fidelidade, novidades e
          caixa em um único celular.
        </Text>

        {requestCount > 0 && (
          <Pressable
            style={styles.alertBanner}
            onPress={() =>
              setTab('requests')
            }
          >
            <Text
              style={styles.alertBannerTitle}
            >
              🔔 {requestCount} nova(s)
              solicitação(ões)
            </Text>

            <Text
              style={styles.alertBannerText}
            >
              Toque para abrir e negociar
              com o cliente.
            </Text>
          </Pressable>
        )}
      </Card>

      <View style={styles.grid}>
        {[
          ['requests', 'Solicitações'],
          ['clients', 'Clientes'],
          ['professionals', 'Profissionais'],
          ['services', 'Serviços'],
          ['vouchers', 'Vouchers'],
          ['news', 'Novidades'],
          ['cash', 'Caixa'],
          ['loyalty', 'Fidelidade'],
        ].map(([key, title]) => (
          <Pressable
            key={key}
            style={styles.tile}
            onPress={() =>
              setTab(key as Tab)
            }
          >
            <Text style={styles.tileIcon}>
              {key === 'cash'
                ? 'R$'
                : key === 'requests'
                ? '🔔'
                : key === 'clients'
                ? '👥'
                : key === 'professionals'
                ? '✂️'
                : key === 'services'
                ? '💇‍♀️'
                : key === 'vouchers'
                ? '🎟️'
                : key === 'news'
                ? '✨'
                : '💗'}
            </Text>

            <Text style={styles.tileText}>
              {title}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  )
}

function ManagerRequests() {
  const [rows, setRows] =
    useState<RequestRow[]>([])

  const [pros, setPros] =
    useState<Professional[]>([])

  const [loading, setLoading] =
    useState(true)

  const [selected, setSelected] =
    useState<RequestRow | null>(null)

  const [pendingDelete, setPendingDelete] =
    useState<RequestRow | null>(null)

  const [recusarPendente, setRecusarPendente] =
    useState<RequestRow | null>(null)

  const [deleteError, setDeleteError] =
    useState('')

  const [actionError, setActionError] =
    useState('')

  async function load() {
    setLoading(true)

    const {
      data,
      error,
    } = await supabase
      .from('manager_service_requests')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    const {
      data: professionals,
    } = await supabase
      .from('professionals')
      .select(
        'id,name,specialty,active'
      )
      .eq('active', true)
      .order('name')

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    }

    setRows(
      (data || []) as RequestRow[]
    )

    setPros(
      (professionals || []) as Professional[]
    )

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function saveStatus(
    id: string,
    status: string
  ) {
    setActionError('')

    const {
      data,
      error,
    } = await supabase
      .from('service_requests')
      .update({ status })
      .eq('id', id)
      .select('id,status')
      .maybeSingle()

    if (error || !data) {
      setActionError(
        error?.message ||
          'Nenhuma solicitação foi alterada. Verifique se o usuário está como gestor no Supabase.'
      )
    } else {
      setSelected(null)
      load()
    }
  }

  async function removeRequest() {
    if (!pendingDelete) return

    setDeleteError('')
    setActionError('')

    const { data, error } = await supabase
      .from('service_requests')
      .delete()
      .eq('id', pendingDelete.id)
      .select('id')

    if (error || !data || data.length === 0) {
      setDeleteError(
        error?.message ||
          'A solicitação não foi excluída. Verifique a policy de DELETE para gestores no Supabase.'
      )
    } else {
      setPendingDelete(null)
      load()
    }
  }

  async function saveAppointment() {
    if (!selected) return

    const payload = {
      preferred_date:
        selected.preferred_date ||
        null,

      scheduled_at:
        selected.scheduled_at ||
        null,

      negotiated_price:
        selected.negotiated_price == null
          ? null
          : Number(
              selected.negotiated_price
            ),

      professional_id:
        selected.professional_id ||
        null,

      status: 'confirmed',
    }

    const {
      error,
    } = await supabase
      .from('service_requests')
      .update(payload)
      .eq('id', selected.id)

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      Alert.alert(
        'Agendamento salvo',
        'Solicitação confirmada.'
      )

      setSelected(null)
      load()
    }
  }

  return (
    <>
      <SectionTitle subtitle="As novas solicitações aparecem no topo.">
        Solicitações
      </SectionTitle>

      {loading ? (
        <View style={styles.centerSmall}>
          <ActivityIndicator
            color={COLORS.primary}
          />
        </View>
      ) : rows.length === 0 ? (
        <Card>
          <Text style={styles.muted}>
            Nenhuma solicitação
            recebida.
          </Text>
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.id}>
            <Text style={styles.itemTitle}>
              {row.service_name}
            </Text>

            <Text>
              Cliente: {row.client_name}
            </Text>

            <Text>
              Celular:{' '}
              {row.client_phone || '-'}
            </Text>

            <Text>
              Data desejada:{' '}
              {row.preferred_date ||
                'A combinar'}
            </Text>

            {row.negotiated_price != null && (
              <Text style={styles.price}>
                Negociado:{' '}
                {formatMoney(
                  row.negotiated_price
                )}
              </Text>
            )}

            {row.voucher_code ? (
              <Text>
                Voucher: {row.voucher_code}
              </Text>
            ) : null}

            {row.notes ? (
              <Text>
                Observação: {row.notes}
              </Text>
            ) : null}

            <Text
              style={styles.statusText}
            >
              Status: {row.status}
            </Text>

            {actionError ? (
              <Text style={styles.authError}>
                {actionError}
              </Text>
            ) : null}

            <View style={styles.rowWrap}>
              <Button
                title="Abrir"
                onPress={() => {
                  setActionError('')
                  setPendingDelete(null)
                  setSelected({
                    ...row,
                  })
                }}
              />

              <Button
                title="Negociar"
                secondary
                onPress={() => {
                  setActionError('')
                  setSelected({
                    ...row,
                  })
                }}
              />

              <Button
                title="Recusar"
                danger
                onPress={() => {
                  setActionError('')
                  setRecusarPendente(row)
                }}
              />

              <Button
                title="Excluir"
                danger
                onPress={() => {
                  setDeleteError('')
                  setPendingDelete(row)
                }}
              />
            </View>
          </Card>
        ))
      )}

      <Modal
        transparent
        visible={!!selected}
        animationType="slide"
        onRequestClose={() =>
          setSelected(null)
        }
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={
              styles.modalScroll
            }
          >
            <Card>
              {selected && (
                <>
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    Negociação e agendamento
                  </Text>

                  <Text
                    style={styles.modalStrong}
                  >
                    {selected.client_name} —{' '}
                    {selected.service_name}
                  </Text>

                  <Text style={styles.label}>
                    Data desejada
                  </Text>

                  <Field
                    value={
                      selected.preferred_date ||
                      ''
                    }
                    onChangeText={(v) =>
                      setSelected({
                        ...selected,
                        preferred_date: v,
                      })
                    }
                    placeholder="20/09/2026"
                  />

                  <Text style={styles.label}>
                    Data/hora confirmada
                  </Text>

                  <Field
                    value={
                      selected.scheduled_at ||
                      ''
                    }
                    onChangeText={(v) =>
                      setSelected({
                        ...selected,
                        scheduled_at: v,
                      })
                    }
                    placeholder="20/09/2026 14:00"
                  />

                  <Text style={styles.label}>
                    Valor negociado
                  </Text>

                  <Field
                    value={
                      selected.negotiated_price ==
                      null
                        ? ''
                        : String(
                            selected.negotiated_price
                          )
                    }
                    onChangeText={(v) =>
                      setSelected({
                        ...selected,
                        negotiated_price:
                          Number(
                            v.replace(
                              ',',
                              '.'
                            )
                          ) || 0,
                      })
                    }
                    placeholder="Ex.: 120,00"
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.label}>
                    Profissional
                  </Text>

                  {pros.map((p) => (
                    <Pressable
                      key={p.id}
                      style={[
                        styles.choice,
                        selected.professional_id ===
                          p.id &&
                          styles.choiceSelected,
                      ]}
                      onPress={() =>
                        setSelected({
                          ...selected,
                          professional_id:
                            p.id,
                        })
                      }
                    >
                      <Text
                        style={
                          selected.professional_id ===
                          p.id
                            ? styles.choiceTextSelected
                            : styles.choiceText
                        }
                      >
                        {p.name} —{' '}
                        {p.specialty}
                      </Text>
                    </Pressable>
                  ))}

                  <Button
                    title="Confirmar e salvar"
                    onPress={saveAppointment}
                  />

                  <Button
                    title="Marcar como concluído"
                    secondary
                    onPress={() =>
                      saveStatus(
                        selected.id,
                        'completed'
                      )
                    }
                  />

                  <Button
                    title="Fechar"
                    secondary
                    onPress={() =>
                      setSelected(null)
                    }
                  />
                </>
              )}
            </Card>
          </ScrollView>
        </View>
      </Modal>

      {pendingDelete ? (
        <Card>
          <Text style={styles.sectionTitle}>
            Excluir solicitação?
          </Text>
          <Text style={styles.modalText}>
            A solicitação de {pendingDelete.client_name} será apagada definitivamente.
          </Text>
          {deleteError ? (
            <Text style={styles.authError}>
              {deleteError}
            </Text>
          ) : null}
          <Button
            title="Excluir definitivamente"
            danger
            onPress={removeRequest}
          />
          <Button
            title="Cancelar"
            secondary
            onPress={() => setPendingDelete(null)}
          />
        </Card>
      ) : null}

      {recusarPendente ? (
        <Card>
          <Text style={styles.sectionTitle}>
            Recusar solicitação?
          </Text>
          <Text style={styles.modalText}>
            A solicitação de {recusarPendente.client_name} será marcada como cancelada.
          </Text>
          <Button
            title="Confirmar recusa"
            danger
            onPress={() => {
              setActionError('')
              saveStatus(
                recusarPendente.id,
                'cancelled'
              )
              setRecusarPendente(null)
            }}
          />
          <Button
            title="Cancelar"
            secondary
            onPress={() => setRecusarPendente(null)}
          />
        </Card>
      ) : null}
    </>
  )
}

function CrudClients() {
  const [rows, setRows] =
    useState<Client[]>([])

  const [pendingDelete, setPendingDelete] =
    useState<Client | null>(null)

  const [deleteError, setDeleteError] =
    useState('')

  const [name, setName] =
    useState('')

  const [phone, setPhone] =
    useState('')

  const [editing, setEditing] =
    useState<Client | null>(null)

  async function load() {
    const {
      data,
      error,
    } = await supabase
      .from('clients')
      .select(
        'id,user_id,full_name,phone,active'
      )
      .order('full_name')

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    }

    setRows(
      (data || []) as Client[]
    )
  }

  useEffect(() => {
    load()
  }, [])

  async function add() {
    const full_name =
      name.trim()

    const normalized =
      normalizePhone(phone)

    if (
      !full_name ||
      normalized.length < 10
    ) {
      return Alert.alert(
        'Atenção',
        'Informe nome e celular válidos.'
      )
    }

    const {
      error,
    } = await supabase
      .from('clients')
      .insert({
        full_name,
        phone: normalized,
      })

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      setName('')
      setPhone('')
      load()
    }
  }

  async function saveEdit() {
    if (!editing) return

    const {
      error,
    } = await supabase
      .from('clients')
      .update({
        full_name:
          editing.full_name,

        phone: normalizePhone(
          editing.phone
        ),

        active:
          editing.active,
      })
      .eq('id', editing.id)

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      setEditing(null)
      load()
    }
  }

  async function remove() {
    if (!pendingDelete) return

    setDeleteError('')

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', pendingDelete.id)

    if (error) {
      setDeleteError(error.message)
    } else {
      setPendingDelete(null)
      load()
    }
  }

  return (
    <>
      <SectionTitle>
        Clientes
      </SectionTitle>

      <Card>
        <Text style={styles.label}>
          Novo cliente
        </Text>

        <Field
          value={name}
          onChangeText={setName}
          placeholder="Nome completo"
        />

        <PhoneField
          value={phone}
          onChangeText={setPhone}
          placeholder="Celular"
        />

        <Button
          title="Cadastrar cliente"
          onPress={add}
        />
      </Card>

      {rows.map((row) => (
        <Card key={row.id}>
          <Text style={styles.itemTitle}>
            {row.full_name}
          </Text>

          <Text>
            Celular: {row.phone}
          </Text>

          <Text>
            Status:{' '}
            {row.active
              ? 'Ativo'
              : 'Inativo'}
          </Text>

          <View style={styles.rowWrap}>
            <Button
              title="Editar"
              secondary
              onPress={() =>
                setEditing({
                  ...row,
                })
              }
            />

            <Button
              title="Excluir"
              danger
              onPress={() =>
                setPendingDelete(row)
              }
            />
          </View>
        </Card>
      ))}

      {editing ? (
        <Card>
          <Text
            style={
              styles.sectionTitle
            }
          >
            Editar cliente
          </Text>

          <Field
            value={
              editing.full_name
            }
            onChangeText={(v) =>
              setEditing({
                ...editing,
                full_name: v,
              })
            }
            placeholder="Nome completo"
          />

          <PhoneField
            value={
              editing.phone
            }
            onChangeText={(v) =>
              setEditing({
                ...editing,
                phone: v,
              })
            }
            placeholder="Celular"
          />

          <Button
            title="Salvar"
            onPress={saveEdit}
          />

          <Button
            title={
              editing.active
                ? 'Desativar'
                : 'Ativar'
            }
            secondary
            onPress={() =>
              setEditing({
                ...editing,
                active:
                  !editing.active,
              })
            }
          />

          <Button
            title="Cancelar"
            secondary
            onPress={() =>
              setEditing(null)
            }
          />
        </Card>
      ) : null}

      {pendingDelete ? (
        <Card>
          <Text style={styles.sectionTitle}>
            Excluir cliente?
          </Text>
          <Text style={styles.modalText}>
            {pendingDelete?.full_name} será removido do cadastro.
          </Text>
          {deleteError ? (
            <Text style={styles.authError}>
              {deleteError}
            </Text>
          ) : null}
          <Button
            title="Excluir definitivamente"
            danger
            onPress={remove}
          />
          <Button
            title="Cancelar"
            secondary
            onPress={() => setPendingDelete(null)}
          />
        </Card>
      ) : null}
    </>
  )
}

function CrudProfessionals() {
  const [rows, setRows] =
    useState<Professional[]>([])

  const [name, setName] =
    useState('')

  const [specialty, setSpecialty] =
    useState('')

  const [editing, setEditing] =
    useState<Professional | null>(null)

  async function load() {
    const {
      data,
      error,
    } = await supabase
      .from('professionals')
      .select(
        'id,name,specialty,active'
      )
      .order('name')

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    }

    setRows(
      (data || []) as Professional[]
    )
  }

  useEffect(() => {
    load()
  }, [])

  async function add() {
    if (
      !name.trim() ||
      !specialty.trim()
    ) {
      return Alert.alert(
        'Atenção',
        'Informe nome e especialidade.'
      )
    }

    const {
      error,
    } = await supabase
      .from('professionals')
      .insert({
        name: name.trim(),
        specialty:
          specialty.trim(),
      })

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      setName('')
      setSpecialty('')
      load()
    }
  }

  async function saveEdit() {
    if (!editing) return

    const {
      error,
    } = await supabase
      .from('professionals')
      .update({
        name: editing.name,
        specialty:
          editing.specialty,
        active:
          editing.active,
      })
      .eq('id', editing.id)

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      setEditing(null)
      load()
    }
  }

  async function remove(id: string) {
    const {
      error,
    } = await supabase
      .from('professionals')
      .delete()
      .eq('id', id)

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      load()
    }
  }

  return (
    <>
      <SectionTitle>
        Profissionais
      </SectionTitle>

      <Card>
        <Field
          value={name}
          onChangeText={setName}
          placeholder="Nome do profissional"
        />

        <Field
          value={specialty}
          onChangeText={setSpecialty}
          placeholder="Especialidade"
        />

        <Button
          title="Cadastrar profissional"
          onPress={add}
        />
      </Card>

      {rows.map((r) => (
        <Card key={r.id}>
          <Text style={styles.itemTitle}>
            {r.name}
          </Text>

          <Text>{r.specialty}</Text>

          <Text>
            {r.active
              ? 'Ativo'
              : 'Inativo'}
          </Text>

          <View style={styles.rowWrap}>
            <Button
              title="Editar"
              secondary
              onPress={() =>
                setEditing({
                  ...r,
                })
              }
            />

            <Button
              title="Excluir"
              danger
              onPress={() =>
                remove(r.id)
              }
            />
          </View>
        </Card>
      ))}

      {editing ? (
        <Card>
          <Text
            style={
              styles.sectionTitle
            }
          >
            Editar profissional
          </Text>

          <Field
            value={editing.name}
            onChangeText={(v) =>
              setEditing({
                ...editing,
                name: v,
              })
            }
            placeholder="Nome"
          />

          <Field
            value={
              editing.specialty
            }
            onChangeText={(v) =>
              setEditing({
                ...editing,
                specialty: v,
              })
            }
            placeholder="Especialidade"
          />

          <Button
            title="Salvar"
            onPress={saveEdit}
          />

          <Button
            title={
              editing.active
                ? 'Desativar'
                : 'Ativar'
            }
            secondary
            onPress={() =>
              setEditing({
                ...editing,
                active:
                  !editing.active,
              })
            }
          />

          <Button
            title="Cancelar"
            secondary
            onPress={() =>
              setEditing(null)
            }
          />
        </Card>
      ) : null}
    </>
  )
}

function CrudServices() {
  const [rows, setRows] =
    useState<Service[]>([])

  const [name, setName] =
    useState('')

  const [price, setPrice] =
    useState('')

  const [editing, setEditing] =
    useState<Service | null>(null)

  async function load() {
    const {
      data,
      error,
    } = await supabase
      .from('services')
      .select(
        'id,name,price,active'
      )
      .order('name')

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    }

    setRows(
      (data || []).map(
        (r: any) => ({
          ...r,
          price: Number(
            r.price
          ),
        })
      )
    )
  }

  useEffect(() => {
    load()
  }, [])

  async function add() {
    const value =
      Number(
        price.replace(',', '.')
      )

    if (
      !name.trim() ||
      Number.isNaN(value) ||
      value < 0
    ) {
      return Alert.alert(
        'Atenção',
        'Informe serviço e valor válidos.'
      )
    }

    const {
      error,
    } = await supabase
      .from('services')
      .insert({
        name: name.trim(),
        price: value,
      })

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      setName('')
      setPrice('')
      load()
    }
  }

  async function saveEdit() {
    if (!editing) return

    const {
      error,
    } = await supabase
      .from('services')
      .update({
        name: editing.name,
        price: Number(
          editing.price
        ),
        active:
          editing.active,
      })
      .eq('id', editing.id)

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      setEditing(null)
      load()
    }
  }

  async function remove(id: string) {
    const {
      error,
    } = await supabase
      .from('services')
      .delete()
      .eq('id', id)

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      load()
    }
  }

  return (
    <>
      <SectionTitle subtitle="O preço é exclusivo do gestor.">
        Serviços
      </SectionTitle>

      <Card>
        <Field
          value={name}
          onChangeText={setName}
          placeholder="Nome do serviço"
        />

        <Field
          value={price}
          onChangeText={setPrice}
          placeholder="Valor ex.: 80,00"
          keyboardType="decimal-pad"
        />

        <Button
          title="Cadastrar serviço"
          onPress={add}
        />
      </Card>

      {rows.map((r) => (
        <Card key={r.id}>
          <Text style={styles.itemTitle}>
            {r.name}
          </Text>

          <Text style={styles.price}>
            {formatMoney(r.price)}
          </Text>

          <Text>
            {r.active
              ? 'Ativo para solicitação'
              : 'Inativo'}
          </Text>

          <View style={styles.rowWrap}>
            <Button
              title="Editar"
              secondary
              onPress={() =>
                setEditing({
                  ...r,
                })
              }
            />

            <Button
              title="Excluir"
              danger
              onPress={() =>
                remove(r.id)
              }
            />
          </View>
        </Card>
      ))}

      {editing ? (
        <Card>
          <Text
            style={
              styles.sectionTitle
            }
          >
            Editar serviço
          </Text>

          <Field
            value={editing.name}
            onChangeText={(v) =>
              setEditing({
                ...editing,
                name: v,
              })
            }
            placeholder="Nome"
          />

          <Field
            value={String(
              editing.price
            )}
            onChangeText={(v) =>
              setEditing({
                ...editing,
                price:
                  Number(
                    v.replace(
                      ',',
                      '.'
                    )
                  ) || 0,
              })
            }
            placeholder="Valor"
            keyboardType="decimal-pad"
          />

          <Button
            title="Salvar"
            onPress={saveEdit}
          />

          <Button
            title={
              editing.active
                ? 'Desativar'
                : 'Ativar'
            }
            secondary
            onPress={() =>
              setEditing({
                ...editing,
                active:
                  !editing.active,
              })
            }
          />

          <Button
            title="Cancelar"
            secondary
            onPress={() =>
              setEditing(null)
            }
          />
        </Card>
      ) : null}
    </>
  )
}

function CrudNews() {
  const [rows, setRows] =
    useState<any[]>([])

  const [title, setTitle] =
    useState('')

  const [body, setBody] =
    useState('')

  async function load() {
    const {
      data,
      error,
    } = await supabase
      .from('news')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    }

    setRows(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function add() {
    if (
      !title.trim() ||
      !body.trim()
    ) {
      return Alert.alert(
        'Atenção',
        'Informe título e conteúdo.'
      )
    }

    const {
      error,
    } = await supabase
      .from('news')
      .insert({
        title: title.trim(),
        body: body.trim(),
      })

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      setTitle('')
      setBody('')
      load()
    }
  }

  async function toggle(
    id: string,
    active: boolean
  ) {
    const {
      error,
    } = await supabase
      .from('news')
      .update({
        active: !active,
      })
      .eq('id', id)

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      load()
    }
  }

  return (
    <>
      <SectionTitle>
        Novidades
      </SectionTitle>

      <Card>
        <Field
          value={title}
          onChangeText={setTitle}
          placeholder="Título"
        />

        <View
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 6,
            padding: 10,
            marginVertical: 8,
            minHeight: 120,
          }}
        >
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Texto"
            multiline
            numberOfLines={5}
            style={{
              fontSize: 16,
              color: '#333',
            }}
          />
        </View>

        <Button
          title="Publicar novidade"
          onPress={add}
        />
      </Card>

      {rows.map((r) => (
        <Card key={r.id}>
          <Text style={styles.itemTitle}>
            {r.title}
          </Text>

          <Text>{r.body}</Text>

          <Text>
            {r.active
              ? 'Publicado'
              : 'Oculto'}
          </Text>

          <Button
            title={
              r.active
                ? 'Ocultar'
                : 'Publicar'
            }
            secondary
            onPress={() =>
              toggle(
                r.id,
                r.active
              )
            }
          />
        </Card>
      ))}
    </>
  )
}

function CashManager() {
  const [rows, setRows] =
    useState<any[]>([])

  const [clients, setClients] =
    useState<Client[]>([])

  const [services, setServices] =
    useState<Service[]>([])

  const [kind, setKind] =
    useState<'income' | 'expense'>(
      'income'
    )

  const [description, setDescription] =
    useState('')

  const [amount, setAmount] =
    useState('')

  const [clientId, setClientId] =
    useState('')

  const [serviceId, setServiceId] =
    useState('')

  const [period, setPeriod] =
    useState<'day' | 'week' | 'month'>(
      'day'
    )

  async function load() {
    const [
      {
        data,
        error,
      },
      {
        data: clientData,
      },
      {
        data: serviceData,
      },
    ] = await Promise.all([
      supabase
        .from('cash_entries')
        .select('*')
        .order('occurred_at', {
          ascending: false,
        }),

      supabase
        .from('clients')
        .select(
          'id,full_name,phone,user_id,active'
        )
        .order('full_name'),

      supabase
        .from('services')
        .select(
          'id,name,price,active'
        )
        .order('name'),
    ])

    if (error) {
      Alert.alert(
        'Erro ao carregar caixa',
        error.message
      )
    }

    setRows(data || [])

    setClients(
      (clientData ||
        []) as Client[]
    )

    setServices(
      (serviceData ||
        []) as Service[]
    )
  }

  useEffect(() => {
    load()
  }, [])

  function inPeriod(value: string) {
    const date = new Date(value)
    const now = new Date()

    if (period === 'day') {
      return (
        date.toDateString() ===
        now.toDateString()
      )
    }

    if (period === 'week') {
      const start = new Date(now)

      start.setDate(
        now.getDate() - 6
      )

      start.setHours(
        0,
        0,
        0,
        0
      )

      return date >= start
    }

    return (
      date.getFullYear() ===
        now.getFullYear() &&
      date.getMonth() ===
        now.getMonth()
    )
  }

  const filtered =
    rows.filter((row) =>
      inPeriod(
        row.occurred_at
      )
    )

  const total =
    filtered.reduce(
      (sum, row) =>
        sum +
        (row.kind ===
        'income'
          ? Number(
              row.amount
            )
          : -Number(
              row.amount
            )),
      0
    )

  const income =
    filtered
      .filter(
        (row) =>
          row.kind === 'income'
      )
      .reduce(
        (sum, row) =>
          sum +
          Number(
            row.amount
          ),
        0
      )

  const expense =
    filtered
      .filter(
        (row) =>
          row.kind === 'expense'
      )
      .reduce(
        (sum, row) =>
          sum +
          Number(
            row.amount
          ),
        0
      )

  const clientTotals =
    clients
      .map((client) => ({
        client,

        total: filtered
          .filter(
            (row) =>
              row.client_id ===
                client.id &&
              row.kind ===
                'income'
          )
          .reduce(
            (sum, row) =>
              sum +
              Number(
                row.amount
              ),
            0
          ),
      }))
      .filter(
        (item) =>
          item.total > 0
      )

  async function add() {
    const value =
      Number(
        amount.replace(',', '.')
      )

    if (
      !description.trim() ||
      Number.isNaN(value) ||
      value <= 0
    ) {
      return Alert.alert(
        'Atenção',
        'Informe descrição e valor válidos.'
      )
    }

    if (
      kind === 'income' &&
      !clientId
    ) {
      return Alert.alert(
        'Atenção',
        'Selecione o cliente atendido.'
      )
    }

    /*
     * Tenta inserir os campos normalmente usados
     * pelo projeto.
     */
    const payload: any = {
      kind,
      description:
        description.trim(),
      amount: value,
      client_id:
        clientId || null,
      service_id:
        serviceId || null,
    }

    const {
      error,
    } = await supabase
      .from('cash_entries')
      .insert(payload)

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
      return
    }

    setDescription('')
    setAmount('')
    setClientId('')
    setServiceId('')

    load()
  }

  return (
    <>
      <SectionTitle subtitle="Controle por cliente e período, sincronizado na nuvem.">
        Caixa
      </SectionTitle>

      <View style={styles.kindRow}>
        <Button
          title="Hoje"
          secondary={
            period !== 'day'
          }
          onPress={() =>
            setPeriod('day')
          }
        />

        <Button
          title="7 dias"
          secondary={
            period !== 'week'
          }
          onPress={() =>
            setPeriod('week')
          }
        />

        <Button
          title="Mês"
          secondary={
            period !== 'month'
          }
          onPress={() =>
            setPeriod('month')
          }
        />
      </View>

      <Card>
        <Text style={styles.balance}>
          {formatMoney(total)}
        </Text>

        <Text>
          Entradas:{' '}
          {formatMoney(income)}
        </Text>

        <Text>
          Saídas:{' '}
          {formatMoney(expense)}
        </Text>

        <Text style={styles.helperText}>
          Período selecionado:{' '}
          {period === 'day'
            ? 'hoje'
            : period === 'week'
            ? 'últimos 7 dias'
            : 'mês atual'}
        </Text>
      </Card>

      <Card>
        <Text style={styles.label}>
          Novo lançamento
        </Text>

        <View style={styles.kindRow}>
          <Pressable
            onPress={() =>
              setKind('income')
            }
            style={[
              styles.kindPill,
              kind === 'income' &&
                styles.kindPillSelected,
            ]}
          >
            <Text>Entrada</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              setKind('expense')
            }
            style={[
              styles.kindPill,
              kind === 'expense' &&
                styles.kindPillSelected,
            ]}
          >
            <Text>Saída</Text>
          </Pressable>
        </View>

        {kind === 'income' ? (
          <>
            <Text style={styles.label}>
              Cliente atendido
            </Text>

            {clients.map(
              (client) => (
                <Pressable
                  key={client.id}
                  onPress={() =>
                    setClientId(
                      client.id
                    )
                  }
                  style={[
                    styles.choice,
                    clientId ===
                      client.id &&
                      styles.choiceSelected,
                  ]}
                >
                  <Text>
                    {
                      client.full_name
                    }
                  </Text>
                </Pressable>
              )
            )}
          </>
        ) : null}

        {kind === 'income' ? (
          <>
            <Text style={styles.label}>
              Serviço
            </Text>

            {services
              .filter(
                (service) =>
                  service.active
              )
              .map((service) => (
                <Pressable
                  key={service.id}
                  onPress={() =>
                    setServiceId(
                      service.id
                    )
                  }
                  style={[
                    styles.choice,
                    serviceId ===
                      service.id &&
                      styles.choiceSelected,
                  ]}
                >
                  <Text>
                    {service.name}
                  </Text>
                </Pressable>
              ))}
          </>
        ) : null}

        <Field
          value={description}
          onChangeText={
            setDescription
          }
          placeholder="Descrição do atendimento"
        />

        <Field
          value={amount}
          onChangeText={setAmount}
          placeholder="Valor"
          keyboardType="decimal-pad"
        />

        <Button
          title="Lançar no caixa"
          onPress={add}
        />
      </Card>

      <SectionTitle>
        Totais por cliente
      </SectionTitle>

      {clientTotals.length ===
      0 ? (
        <Card>
          <Text style={styles.muted}>
            Nenhum atendimento no
            período.
          </Text>
        </Card>
      ) : (
        clientTotals.map(
          (item) => (
            <Card
              key={item.client.id}
            >
              <Text
                style={
                  styles.itemTitle
                }
              >
                {
                  item.client
                    .full_name
                }
              </Text>

              <Text style={styles.price}>
                {formatMoney(
                  item.total
                )}
              </Text>
            </Card>
          )
        )
      )}

      <SectionTitle>
        Histórico
      </SectionTitle>

      {filtered.map((row) => (
        <Card key={row.id}>
          <Text
            style={
              styles.itemTitle
            }
          >
            {row.description}
          </Text>

          <Text
            style={
              row.kind ===
              'income'
                ? styles.success
                : styles.dangerText
            }
          >
            {row.kind ===
            'income'
              ? '+'
              : '-'}{' '}
            {formatMoney(
              Number(
                row.amount
              )
            )}
          </Text>

          <Text>
            {clients.find(
              (client) =>
                client.id ===
                row.client_id
            )?.full_name ||
              'Sem cliente'}
          </Text>

          <Text style={styles.helperText}>
            {formatDateTime(
              row.occurred_at
            )}
          </Text>
        </Card>
      ))}
    </>
  )
}

function ManagerVouchersCloud() {
  const [items, setItems] =
    useState<any[]>([])

  const [editing, setEditing] =
    useState<any | null>(null)

  const [code, setCode] =
    useState('')

  const [description, setDescription] =
    useState('')

  const [discount, setDiscount] =
    useState('')

  async function load() {
    const {
      data,
      error,
    } = await supabase
      .from('vouchers')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    }

    setItems(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(item: any) {
    setEditing(item)
    setCode(item.code)
    setDescription(
      item.description || ''
    )
    setDiscount(
      String(
        item.discount_percent
      )
    )
  }

  function clearForm() {
    setEditing(null)
    setCode('')
    setDescription('')
    setDiscount('')
  }

  async function save() {
    const value =
      Number(
        discount.replace(',', '.')
      )

    if (
      !code.trim() ||
      Number.isNaN(value) ||
      value < 0 ||
      value > 100
    ) {
      return Alert.alert(
        'Atenção',
        'Informe código e desconto entre 0 e 100%.'
      )
    }

    const payload = {
      code: code
        .trim()
        .toUpperCase(),
      description:
        description.trim() ||
        null,
      discount_percent:
        value,
    }

    const result = editing
      ? await supabase
          .from('vouchers')
          .update(payload)
          .eq(
            'id',
            editing.id
          )
      : await supabase
          .from('vouchers')
          .insert({
            ...payload,
            active: true,
          })

    if (result.error) {
      return Alert.alert(
        'Erro',
        result.error.message
      )
    }

    clearForm()
    load()
  }

  async function toggle(
    item: any
  ) {
    const {
      error,
    } = await supabase
      .from('vouchers')
      .update({
        active: !item.active,
      })
      .eq('id', item.id)

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      load()
    }
  }

  async function remove(
    item: any
  ) {
    Alert.alert(
      'Excluir voucher',
      `Excluir ${item.code}?`,
      [
        {
          text: 'Cancelar',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const {
              error,
            } = await supabase
              .from('vouchers')
              .delete()
              .eq(
                'id',
                item.id
              )

            if (error) {
              Alert.alert(
                'Erro',
                error.message
              )
            } else {
              load()
            }
          },
        },
      ]
    )
  }

  return (
    <>
      <SectionTitle subtitle="Gerencie os vouchers disponíveis para os clientes.">
        Vouchers
      </SectionTitle>

      <Card>
        <Text style={styles.label}>
          {editing
            ? 'Editar voucher'
            : 'Novo voucher'}
        </Text>

        <Field
          value={code}
          onChangeText={setCode}
          placeholder="Código"
        />

        <Field
          value={description}
          onChangeText={
            setDescription
          }
          placeholder="Descrição"
        />

        <Field
          value={discount}
          onChangeText={setDiscount}
          placeholder="Desconto %"
          keyboardType="decimal-pad"
        />

        <Button
          title={
            editing
              ? 'Salvar alterações'
              : 'Adicionar voucher'
          }
          onPress={save}
        />

        {editing ? (
          <Button
            title="Cancelar edição"
            secondary
            onPress={clearForm}
          />
        ) : null}
      </Card>

      {items.map((item) => (
        <Card key={item.id}>
          <Text style={styles.itemTitle}>
            {item.code}
          </Text>

          <Text>
            {item.description ||
              'Sem descrição'}{' '}
            | {item.discount_percent}%
          </Text>

          <Text>
            {item.active
              ? 'Ativo'
              : 'Inativo'}
          </Text>

          <View style={styles.rowWrap}>
            <Button
              title="Editar"
              secondary
              onPress={() =>
                startEdit(item)
              }
            />

            <Button
              title={
                item.active
                  ? 'Desativar'
                  : 'Ativar'
              }
              secondary
              onPress={() =>
                toggle(item)
              }
            />

            <Button
              title="Excluir"
              danger
              onPress={() =>
                remove(item)
              }
            />
          </View>
        </Card>
      ))}
    </>
  )
}

function ManagerLoyaltyCloud() {
  const [settings, setSettings] =
    useState<any>(null)

  const [points, setPoints] =
    useState('10')

  const [rewards, setRewards] =
    useState<any[]>([])

  const [editing, setEditing] =
    useState<any | null>(null)

  const [pendingDeleteReward, setPendingDeleteReward] =
    useState<any | null>(null)

  const [name, setName] =
    useState('')

  const [description, setDescription] =
    useState('')

  const [required, setRequired] =
    useState('')

  const [bonus, setBonus] =
    useState('')

  async function load() {
    const [
      {
        data: setting,
      },
      {
        data,
        error,
      },
    ] = await Promise.all([
      supabase
        .from('loyalty_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle(),

      supabase
        .from('loyalty_rewards')
        .select('*')
        .order(
          'points_required'
        ),
    ])

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    }

    setSettings(
      setting || null
    )

    setPoints(
      String(
        setting?.points_per_completed_service ??
          10
      )
    )

    setRewards(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function saveSettings() {
    const value =
      Number(points)

    if (
      !Number.isInteger(
        value
      ) ||
      value < 0
    ) {
      return Alert.alert(
        'Atenção',
        'Informe uma quantidade inteira de pontos.'
      )
    }

    const payload = {
      id: 1,
      program_active:
        settings?.program_active ??
        true,
      points_per_completed_service:
        value,
    }

    const {
      error,
    } = await supabase
      .from('loyalty_settings')
      .upsert(payload)

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      Alert.alert(
        'Salvo',
        'Configuração de fidelidade atualizada.'
      )

      load()
    }
  }

  function startEdit(item: any) {
    setEditing(item)
    setName(item.name)
    setDescription(
      item.description || ''
    )
    setRequired(
      String(
        item.points_required
      )
    )
    setBonus(
      item.bonus_value == null
        ? ''
        : String(
            item.bonus_value
          )
    )
  }

  function clearForm() {
    setEditing(null)
    setName('')
    setDescription('')
    setRequired('')
    setBonus('')
  }

  async function saveReward() {
    const requiredValue =
      Number(required)

    const bonusValue = bonus.trim()
      ? Number(
          bonus.replace(',', '.')
        )
      : null

    if (
      !name.trim() ||
      !Number.isInteger(
        requiredValue
      ) ||
      requiredValue < 1 ||
      (bonusValue !== null &&
        (Number.isNaN(
          bonusValue
        ) ||
          bonusValue < 0))
    ) {
      return Alert.alert(
        'Atenção',
        'Preencha nome, pontos e bônus válidos.'
      )
    }

    const payload = {
      name: name.trim(),
      description:
        description.trim() ||
        null,
      points_required:
        requiredValue,
      bonus_value:
        bonusValue,
    }

    const result = editing
      ? await supabase
          .from('loyalty_rewards')
          .update(payload)
          .eq(
            'id',
            editing.id
          )
      : await supabase
          .from('loyalty_rewards')
          .insert({
            ...payload,
            active: true,
          })

    if (result.error) {
      return Alert.alert(
        'Erro',
        result.error.message
      )
    }

    clearForm()
    load()
  }

  async function toggle(
    item: any
  ) {
    const {
      error,
    } = await supabase
      .from('loyalty_rewards')
      .update({
        active: !item.active,
      })
      .eq('id', item.id)

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      load()
    }
  }

  async function remove(
    item: any
  ) {
    const {
      error,
    } = await supabase
      .from(
        'loyalty_rewards'
      )
      .delete()
      .eq(
        'id',
        item.id
      )

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      setPendingDeleteReward(null)
      load()
    }
  }

  async function toggleProgram() {
    const {
      error,
    } = await supabase
      .from('loyalty_settings')
      .upsert({
        id: 1,
        program_active:
          !(
            settings?.program_active ??
            true
          ),
        points_per_completed_service:
          Number(points),
      })

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    } else {
      load()
    }
  }

  return (
    <>
      <SectionTitle subtitle="Configure pontos e recompensas do programa.">
        Programa de fidelidade
      </SectionTitle>

      <Card>
        <Text style={styles.label}>
          Pontos por atendimento
          concluído
        </Text>

        <Field
          value={points}
          onChangeText={setPoints}
          placeholder="10"
          keyboardType="numeric"
        />

        <Text>
          Status:{' '}
          {(
            settings?.program_active ??
            true
          )
            ? 'Ativo'
            : 'Desativado'}
        </Text>

        <Button
          title="Salvar configuração"
          onPress={
            saveSettings
          }
        />

        <Button
          title={
            (
              settings?.program_active ??
              true
            )
              ? 'Desativar programa'
              : 'Ativar programa'
          }
          secondary
          onPress={
            toggleProgram
          }
        />
      </Card>

      <Card>
        <Text style={styles.label}>
          {editing
            ? 'Editar recompensa'
            : 'Nova recompensa'}
        </Text>

        <Field
          value={name}
          onChangeText={setName}
          placeholder="Nome da recompensa"
        />

        <Field
          value={description}
          onChangeText={
            setDescription
          }
          placeholder="Descrição"
        />

        <Field
          value={required}
          onChangeText={setRequired}
          placeholder="Pontos necessários"
          keyboardType="numeric"
        />

        <Field
          value={bonus}
          onChangeText={setBonus}
          placeholder="Bônus em R$ (opcional)"
          keyboardType="decimal-pad"
        />

        <Button
          title={
            editing
              ? 'Salvar alterações'
              : 'Adicionar recompensa'
          }
          onPress={
            saveReward
          }
        />

        {editing ? (
          <Button
            title="Cancelar edição"
            secondary
            onPress={clearForm}
          />
        ) : null}
      </Card>

      {rewards.map((item) => (
        <Card key={item.id}>
          <Text style={styles.itemTitle}>
            {item.name}
          </Text>

          <Text>
            {item.points_required}{' '}
            pontos
            {item.bonus_value !=
            null
              ? ` | ${formatMoney(
                  Number(
                    item.bonus_value
                  )
                )}`
              : ''}
          </Text>

          <Text>
            {item.active
              ? 'Ativa'
              : 'Inativa'}
          </Text>

          <View style={styles.rowWrap}>
            <Button
              title="Editar"
              secondary
              onPress={() =>
                startEdit(item)
              }
            />

            <Button
              title={
                item.active
                  ? 'Desativar'
                  : 'Ativar'
              }
              secondary
              onPress={() =>
                toggle(item)
              }
            />

            <Button
              title="Excluir"
              danger
              onPress={() =>
                setPendingDeleteReward(item)
              }
            />
          </View>
        </Card>
      ))}

      {pendingDeleteReward ? (
        <Card>
          <Text style={styles.sectionTitle}>
            Excluir recompensa?
          </Text>
          <Text style={styles.modalText}>
            A recompensa "{pendingDeleteReward.name}" será deletada permanentemente.
          </Text>
          <Button
            title="Excluir definitivamente"
            danger
            onPress={() =>
              remove(pendingDeleteReward)
            }
          />
          <Button
            title="Cancelar"
            secondary
            onPress={() =>
              setPendingDeleteReward(null)
            }
          />
        </Card>
      ) : null}
    </>
  )
}

function ClientApp({
  profile,
}: {
  profile: Profile
}) {
  const [tab, setTab] =
    useState<Tab>('home')

  const logout = () =>
    supabase.auth.signOut()

  return (
    <View style={styles.screen}>
      <Header
        title={`Olá, ${
          profile.full_name.split(' ')[0]
        }`}
        subtitle="Karoline Cabeleireira"
        onLogout={logout}
        onBack={
          tab !== 'home'
            ? () => setTab('home')
            : undefined
        }
      />

      <ScrollView
        contentContainerStyle={styles.container}
      >
        {tab === 'home' && (
          <ClientHome
            profile={profile}
            setTab={setTab}
          />
        )}

        {tab === 'request' && (
          <ServiceRequest
            profile={profile}
          />
        )}

        {tab === 'schedule' && (
          <ClientSchedule
            profile={profile}
          />
        )}

        {tab === 'news' && (
          <ClientNews />
        )}

        {tab === 'loyalty' && (
          <ClientLoyalty
            profile={profile}
          />
        )}
      </ScrollView>

      <BottomNav
        tabs={[
          'home',
          'request',
          'schedule',
          'news',
          'loyalty',
        ]}
        active={tab}
        setTab={setTab}
      />
    </View>
  )
}

function ClientHome({
  profile,
  setTab,
}: {
  profile: Profile
  setTab: (tab: Tab) => void
}) {
  return (
    <>
      <Card>
        <Text style={styles.sectionTitle}>
          Bem-vinda! 💗
        </Text>

        <Text style={styles.muted}>
          Escolha um serviço, envie sua
          solicitação e aguarde a
          negociação com o gestor.
        </Text>
      </Card>

      <Button
        title="Solicitar serviço"
        onPress={() =>
          setTab('request')
        }
      />

      <Button
        title="Meus agendamentos"
        secondary
        onPress={() =>
          setTab('schedule')
        }
      />

      <Button
        title="Minha fidelidade"
        secondary
        onPress={() =>
          setTab('loyalty')
        }
      />

      <Card>
        <Text style={styles.itemTitle}>
          Atendimento pelo WhatsApp
        </Text>

        <Text style={styles.muted}>
          Fale diretamente com o salão.
        </Text>

        <Button
          title="Abrir WhatsApp"
          onPress={() =>
            Linking.openURL(
              `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
                `Olá, sou ${profile.full_name} e gostaria de agendar um atendimento.`
              )}`
            )
          }
        />
      </Card>
    </>
  )
}

function ServiceRequest({
  profile,
}: {
  profile: Profile
}) {
  const [
    services,
    setServices,
  ] = useState<
    Array<{
      id: string
      name: string
      active: boolean
    }>
  >([])

  const [
    selectedServices,
    setSelectedServices,
  ] = useState<string[]>([])

  const [notes, setNotes] =
    useState('')

  const [voucher, setVoucher] =
    useState('')

  const [
    modalVisible,
    setModalVisible,
  ] = useState(false)

  const [
    sendingRequest,
    setSendingRequest,
  ] = useState(false)

  const [
    sendError,
    setSendError,
  ] = useState('')

  const [loading, setLoading] =
    useState(true)

  function toggleService(
    serviceId: string
  ) {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter(
            (id) => id !== serviceId
          )
        : [...prev, serviceId]
    )
  }

  async function load() {
    setLoading(true)

    const {
      data,
      error,
    } = await supabase
      .from('client_services')
      .select(
        'id,name,active'
      )
      .order('name')

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )
    }

    setServices(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function send() {
    if (
      selectedServices.length === 0
    ) {
      setSendError(
        'Selecione pelo menos um serviço'
      )
      return
    }

    setSendingRequest(true)
    setSendError('')

    try {
      const {
        data: client,
        error: clientError,
      } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', profile.id)
        .single()

      if (
        clientError ||
        !client
      ) {
        setSendError(
          clientError?.message ||
            'Não encontramos o cadastro de cliente vinculado à sua conta.'
        )
        setSendingRequest(false)
        return
      }

      const requestsToInsert =
        selectedServices.map(
          (serviceId) => ({
            client_id: client.id,
            service_id: serviceId,
            notes:
              notes.trim() || null,
            voucher_code:
              voucher
                .trim()
                .toUpperCase() ||
              null,
            status: 'new',
          })
        )

      const { error } = await supabase
        .from('service_requests')
        .insert(requestsToInsert)

      if (error) {
        setSendError(
          error.message ||
            'Falha ao enviar solicitação. Verifique sua conexão.'
        )
        setSendingRequest(false)
        return
      }

      setSelectedServices([])
      setNotes('')
      setVoucher('')
      setSendError('')
      setSendingRequest(false)
      setModalVisible(true)
    } catch (err: any) {
      setSendError(
        err.message ||
          'Erro inesperado ao enviar solicitação'
      )
      setSendingRequest(false)
    }
  }

  return (
    <>
      <SectionTitle subtitle="Os serviços são carregados do cadastro do gestor. O valor não aparece.">
        Solicitar serviço
      </SectionTitle>

      <Card>
        <Text style={styles.label}>
          Serviço
        </Text>

        {loading ? (
          <ActivityIndicator
            color={COLORS.primary}
          />
        ) : services.length ===
          0 ? (
          <Text style={styles.muted}>
            Nenhum serviço ativo foi
            cadastrado.
          </Text>
        ) : (
          services.map(
            (service) => (
              <Pressable
                key={service.id}
                style={[
                  styles.choice,
                  selectedServices.includes(
                    service.id
                  ) &&
                    styles.choiceSelected,
                ]}
                onPress={() =>
                  toggleService(
                    service.id
                  )
                }
              >
                <Text
                  style={
                    selectedServices.includes(
                      service.id
                    )
                      ? styles.choiceTextSelected
                      : styles.choiceText
                  }
                >
                  {selectedServices.includes(
                    service.id
                  )
                    ? '✓ '
                    : ''}
                  {service.name}
                </Text>
              </Pressable>
            )
          )
        )}

        <Text style={styles.helperText}>
          Você pode selecionar mais de
          um serviço. O preço não
          aparece para o cliente. O
          gestor fará a negociação.
        </Text>

        <Text style={styles.label}>
          Voucher
        </Text>

        <Field
          value={voucher}
          onChangeText={setVoucher}
          placeholder="Código (opcional)"
        />

        <Text style={styles.label}>
          Observação
        </Text>

        <View
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 6,
            padding: 10,
            marginVertical: 8,
            minHeight: 120,
          }}
        >
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex.: quero mudar a cor dos cabelos"
            multiline
            numberOfLines={5}
            style={{
              fontSize: 16,
              color: '#333',
            }}
          />
        </View>

        {sendError ? (
          <Text
            style={
              styles.authError
            }
          >
            {sendError}
          </Text>
        ) : null}

        {sendingRequest ? (
          <View
            style={{
              flexDirection:
                'row',
              alignItems:
                'center',
              justifyContent:
                'center',
              paddingVertical: 12,
            }}
          >
            <ActivityIndicator
              color={COLORS.primary}
              style={{
                marginRight: 8,
              }}
            />
            <Text>
              Enviando solicitação...
            </Text>
          </View>
        ) : (
          <Button
            title="Enviar solicitação"
            onPress={send}
          />
        )}
      </Card>

      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() =>
          setModalVisible(false)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Solicitação enviada 💗
            </Text>

            <Text
              style={styles.modalText}
            >
              Sua(s) solicitação(ões)
              chegou(chegaram) ao gestor.
              A data, o valor e os
              detalhes serão negociados
              após o recebimento.
            </Text>

            <Button
              title="OK"
              onPress={() =>
                setModalVisible(
                  false
                )
              }
            />
          </View>
        </View>
      </Modal>
    </>
  )
}

function ClientSchedule({
  profile,
}: {
  profile: Profile
}) {
  const [rows, setRows] =
    useState<any[]>([])

  const [loading, setLoading] =
    useState(true)

  async function load() {
    setLoading(true)

    const {
      data: client,
    } = await supabase
      .from('clients')
      .select('id')
      .eq(
        'user_id',
        profile.id
      )
      .single()

    if (!client) {
      setRows([])
      setLoading(false)
      return
    }

    const {
      data: requests,
      error,
    } = await supabase
      .from('service_requests')
      .select(
        'id,service_id,status,preferred_date,notes,voucher_code,scheduled_at,negotiated_price,professional_id,created_at'
      )
      .eq(
        'client_id',
        client.id
      )
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      Alert.alert(
        'Erro',
        error.message
      )

      setRows([])
      setLoading(false)
      return
    }

    const requestRows =
      requests || []

    const serviceIds =
      Array.from(
        new Set(
          requestRows
            .map(
              (item: any) =>
                item.service_id
            )
            .filter(Boolean)
        )
      )

    const professionalIds =
      Array.from(
        new Set(
          requestRows
            .map(
              (item: any) =>
                item.professional_id
            )
            .filter(Boolean)
        )
      )

    let servicesMap: Record<
      string,
      string
    > = {}

    let professionalsMap: Record<
      string,
      string
    > = {}

    if (serviceIds.length > 0) {
      const {
        data: serviceData,
      } = await supabase
        .from('services')
        .select('id,name')
        .in(
          'id',
          serviceIds
        )

      for (const service of
        serviceData || []) {
        servicesMap[
          service.id
        ] = service.name
      }
    }

    if (
      professionalIds.length >
      0
    ) {
      const {
        data: professionalData,
      } = await supabase
        .from('professionals')
        .select('id,name')
        .in(
          'id',
          professionalIds
        )

      for (const professional of
        professionalData || []) {
        professionalsMap[
          professional.id
        ] =
          professional.name
      }
    }

    const mappedRows =
      requestRows.map(
        (row: any) => ({
          ...row,

          service_name:
            servicesMap[
              row.service_id
            ] ||
            'Serviço',

          professional_name:
            row.professional_id
              ? professionalsMap[
                  row.professional_id
                ] || null
              : null,

          agreed_price:
            row.negotiated_price,
        })
      )

    setRows(mappedRows)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <SectionTitle subtitle="Quando o gestor negociar o atendimento, os detalhes aparecem aqui.">
        Meus agendamentos
      </SectionTitle>

      {loading ? (
        <View style={styles.centerSmall}>
          <ActivityIndicator
            color={COLORS.primary}
          />
        </View>
      ) : rows.length ===
        0 ? (
        <Card>
          <Text style={styles.muted}>
            Você ainda não possui
            solicitações.
          </Text>
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.id}>
            <Text style={styles.itemTitle}>
              {r.service_name}
            </Text>

            <Text>
              Status: {r.status}
            </Text>

            <Text>
              Data desejada:{' '}
              {r.preferred_date ||
                'A combinar'}
            </Text>

            {r.scheduled_at ? (
              <Text>
                Agendado para:{' '}
                {formatDateTime(
                  r.scheduled_at
                )}
              </Text>
            ) : null}

            {r.professional_name ? (
              <Text>
                Profissional:{' '}
                {
                  r.professional_name
                }
              </Text>
            ) : null}

            {r.agreed_price !=
            null ? (
              <Text
                style={styles.price}
              >
                Valor negociado:{' '}
                {formatMoney(
                  Number(
                    r.agreed_price
                  )
                )}
              </Text>
            ) : null}

            <Text
              style={styles.helperText}
            >
              O preço base do serviço
              continua oculto; apenas o
              valor negociado pode
              aparecer para você.
            </Text>
          </Card>
        ))
      )}
    </>
  )
}

function ClientNews() {
  const [rows, setRows] =
    useState<any[]>([])

  useEffect(() => {
    supabase
      .from('news')
      .select(
        'id,title,body,created_at'
      )
      .eq('active', true)
      .order('created_at', {
        ascending: false,
      })
      .then(
        ({
          data,
        }) => {
          setRows(data || [])
        }
      )
  }, [])

  return (
    <>
      <SectionTitle>
        Novidades
      </SectionTitle>

      {rows.length === 0 ? (
        <Card>
          <Text style={styles.muted}>
            Ainda não há novidades
            publicadas.
          </Text>
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.id}>
            <Text
              style={
                styles.itemTitle
              }
            >
              {r.title}
            </Text>

            <Text>{r.body}</Text>
          </Card>
        ))
      )}
    </>
  )
}

function ClientLoyalty({
  profile,
}: {
  profile: Profile
}) {
  const [total, setTotal] =
    useState(0)

  const [
    settings,
    setSettings,
  ] =
    useState<LoyaltySetting | null>(
      null
    )

  const [
    rewards,
    setRewards,
  ] =
    useState<Reward[]>([])

  const [
    transactions,
    setTransactions,
  ] =
    useState<LoyaltyTransaction[]>(
      []
    )

  const [loading, setLoading] =
    useState(true)

  async function load() {
    setLoading(true)

    const {
      data: client,
    } = await supabase
      .from('clients')
      .select('id')
      .eq(
        'user_id',
        profile.id
      )
      .single()

    if (!client) {
      setLoading(false)
      return
    }

    const [
      {
        data: setting,
      },
      {
        data: rewardData,
      },
      {
        data: txData,
      },
    ] = await Promise.all([
      supabase
        .from('loyalty_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle(),

      supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('active', true)
        .order(
          'points_required'
        ),

      supabase
        .from('loyalty_transactions')
        .select('*')
        .eq(
          'client_id',
          client.id
        )
        .order('created_at', {
          ascending: false,
        }),
    ])

    const safeTransactions =
      (txData ||
        []) as LoyaltyTransaction[]

    const currentDate =
      new Date()

    const activeTransactions =
      safeTransactions.filter(
        (tx) => {
          if (!tx.expires_at) {
            return true
          }

          const expiration =
            new Date(
              tx.expires_at
            )

          return (
            expiration >=
            currentDate
          )
        }
      )

    const balance =
      activeTransactions.reduce(
        (
          sum,
          transaction
        ) =>
          sum +
          Number(
            transaction.points
          ),
        0
      )

    setTotal(
      Math.max(
        0,
        balance
      )
    )

    setSettings(
      (setting ||
        null) as LoyaltySetting | null
    )

    setRewards(
      (rewardData ||
        []) as Reward[]
    )

    setTransactions(
      safeTransactions
    )

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const next = useMemo(
    () =>
      rewards.find(
        (r) =>
          r.points_required >
          total
      ),
    [rewards, total]
  )

  if (loading) {
    return (
      <>
        <SectionTitle>
          💗 Minha fidelidade
        </SectionTitle>

        <View style={styles.centerSmall}>
          <ActivityIndicator
            color={COLORS.primary}
          />
        </View>
      </>
    )
  }

  const programActive =
    settings?.program_active ??
    settings?.active ??
    true

  return (
    <>
      <SectionTitle subtitle="Você ganha pontos quando o atendimento é concluído pelo gestor.">
        💗 Minha fidelidade
      </SectionTitle>

      {!programActive ? (
        <Card>
          <Text style={styles.muted}>
            O programa de fidelidade está
            temporariamente desativado.
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text
              style={
                styles.itemTitle
              }
            >
              Seus pontos
            </Text>

            <Text
              style={
                styles.loyaltyPoints
              }
            >
              ⭐ {total} pontos
            </Text>

            {next && (
              <>
                <Text>
                  Próxima recompensa:{' '}
                  {next.name}
                </Text>

                <Text>
                  {Math.min(
                    total,
                    next.points_required
                  )}{' '}
                  /{' '}
                  {
                    next.points_required
                  }{' '}
                  pontos
                </Text>

                <View
                  style={
                    styles.progressTrack
                  }
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${
                          Math.min(
                            100,
                            (total /
                              next.points_required) *
                              100
                          )
                        }%`,
                      },
                    ]}
                  />
                </View>
              </>
            )}
          </Card>

          <SectionTitle>
            Recompensas
          </SectionTitle>

          {rewards.length === 0 ? (
            <Card>
              <Text
                style={
                  styles.muted
                }
              >
                O gestor ainda não
                cadastrou recompensas.
              </Text>
            </Card>
          ) : (
            rewards.map((r) => (
              <Card key={r.id}>
                <Text
                  style={
                    styles.itemTitle
                  }
                >
                  🎁 {r.name}
                </Text>

                <Text>
                  {r.description ||
                    ''}
                </Text>

                <Text>
                  {
                    r.points_required
                  }{' '}
                  pontos
                  {r.bonus_value !=
                  null
                    ? ` • bônus ${formatMoney(
                        r.bonus_value
                      )}`
                    : ''}
                </Text>

                <Text
                  style={
                    total >=
                    r.points_required
                      ? styles.success
                      : styles.muted
                  }
                >
                  {total >=
                  r.points_required
                    ? 'Disponível'
                    : 'Ainda não disponível'}
                </Text>
              </Card>
            ))
          )}

          <SectionTitle>
            Extrato de pontos
          </SectionTitle>

          {transactions.length ===
          0 ? (
            <Card>
              <Text style={styles.muted}>
                Ainda não há
                movimentações.
              </Text>
            </Card>
          ) : (
            transactions.map(
              (t) => (
                <Card key={t.id}>
                  <Text
                    style={
                      styles.itemTitle
                    }
                  >
                    {t.points > 0
                      ? '+'
                      : ''}
                    {t.points} pontos
                  </Text>

                  <Text>
                    {t.description}
                  </Text>

                  <Text
                    style={
                      styles.helperText
                    }
                  >
                    {formatDateTime(
                      t.created_at
                    )}
                  </Text>
                </Card>
              )
            )
          )}
        </>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  screen: {
    flex: 1,
    backgroundColor:
      COLORS.bg,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      COLORS.bg,
    padding: 24,
  },

  centerSmall: {
    padding: 30,
    alignItems: 'center',
  },

  authContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor:
      COLORS.bg,
  },

  brandMark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor:
      COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },

  brandLetter: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    fontStyle: 'italic',
  },

  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  logo: {
    textAlign: 'center',
    color: COLORS.primaryDark,
    fontSize: 30,
    fontWeight: '900',
  },

  logoTag: {
    textAlign: 'center',
    color: COLORS.primary,
    marginTop: 0,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },

  subtitle: {
    textAlign: 'center',
    color: COLORS.muted,
    marginTop: 6,
    marginBottom: 20,
  },

  roseWrap: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },

  rosePetal: {
    position: 'absolute',
    backgroundColor: '#e06aa5',
    borderWidth: 1,
    borderColor: '#c84f8d',
    shadowColor: '#a92f6c',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    elevation: 2,
  },

  roseCenter: {
    position: 'absolute',
    backgroundColor: '#f5a2c9',
    borderWidth: 1,
    borderColor: '#d85a96',
  },

  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 7,
  },

  headerBrand: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.6,
  },

  headerTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: COLORS.text,
  },

  headerSub: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },

  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor:
      COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },

  container: {
    padding: 16,
    paddingBottom: 140,
  },

  card: {
    backgroundColor:
      COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    padding: 16,
    marginBottom: 12,
  },

  authTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 10,
  },

  authError: {
    color: COLORS.danger,
    backgroundColor: '#fff0f0',
    borderWidth: 1,
    borderColor: '#efbcbc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    lineHeight: 19,
  },

  sectionHeader: {
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },

  label: {
    color: COLORS.muted,
    fontWeight: '800',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.text,
    marginBottom: 8,
  },

  button: {
    backgroundColor:
      COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 8,
    flex: 1,
  },

  buttonSecondary: {
    backgroundColor:
      COLORS.soft,
    borderWidth: 1,
    borderColor: '#efbdd2',
  },

  buttonDanger: {
    backgroundColor: '#fff0f0',
    borderWidth: 1,
    borderColor: '#efbcbc',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#fff',
    fontWeight: '900',
  },

  buttonSecondaryText: {
    color: COLORS.primaryDark,
  },

  buttonDangerText: {
    color: COLORS.danger,
  },

  link: {
    color: COLORS.primary,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 12,
  },

  muted: {
    color: COLORS.muted,
    lineHeight: 20,
  },

  helperText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent:
      'space-between',
  },

  tile: {
    width: '48%',
    backgroundColor:
      COLORS.soft2,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 16,
    padding: 17,
    marginBottom: 10,
  },

  tileIcon: {
    fontSize: 22,
    marginBottom: 8,
  },

  tileText: {
    color: COLORS.primaryDark,
    fontWeight: '900',
  },

  alertBanner: {
    backgroundColor:
      '#fff0f6',
    borderColor: '#f1aac8',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },

  audioEnableBanner: {
    backgroundColor: '#fff8e8',
    borderColor: '#e8c56d',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },

  alertBannerTitle: {
    color: COLORS.primaryDark,
    fontWeight: '900',
  },

  alertBannerText: {
    color: COLORS.muted,
    marginTop: 3,
  },

  itemTitle: {
    fontSize: 17,
    color: COLORS.text,
    fontWeight: '900',
    marginBottom: 4,
  },

  price: {
    color: COLORS.primaryDark,
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 4,
  },

  statusText: {
    marginTop: 7,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },

  rowWrap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  choice: {
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 12,
    marginBottom: 8,
  },

  choiceSelected: {
    backgroundColor:
      COLORS.soft,
    borderColor:
      COLORS.primary,
  },

  choiceText: {
    color: COLORS.text,
  },

  choiceTextSelected: {
    color: COLORS.primaryDark,
    fontWeight: '900',
  },

  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor:
      COLORS.card,
    borderTopWidth: 1,
    borderTopColor:
      COLORS.border,
    paddingVertical: 8,
  },

  bottomScroll: {
    paddingHorizontal: 10,
    gap: 8,
  },

  bottomItem: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
  },

  bottomItemActive: {
    backgroundColor:
      COLORS.soft,
  },

  bottomText: {
    color: COLORS.muted,
    fontWeight: '800',
  },

  bottomTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '900',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor:
      'rgba(45,18,30,0.42)',
    justifyContent: 'center',
    padding: 18,
  },

  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  modalBox: {
    backgroundColor:
      COLORS.card,
    borderRadius: 20,
    padding: 18,
  },

  modalStrong: {
    color: COLORS.text,
    fontWeight: '900',
    marginBottom: 6,
  },

  modalText: {
    color: COLORS.text,
    lineHeight: 21,
    marginBottom: 5,
  },

  balance: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: 10,
  },

  kindRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },

  kindPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor:
      '#faf6f8',
  },

  kindPillSelected: {
    backgroundColor:
      COLORS.soft,
  },

  success: {
    color: COLORS.success,
    fontWeight: '900',
  },

  dangerText: {
    color: COLORS.danger,
    fontWeight: '900',
  },

  loyaltyPoints: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginVertical: 8,
  },

  progressTrack: {
    height: 10,
    borderRadius: 10,
    backgroundColor:
      COLORS.soft,
    overflow: 'hidden',
    marginTop: 8,
  },

  progressFill: {
    height: 10,
    borderRadius: 10,
    backgroundColor:
      COLORS.primary,
  },
})