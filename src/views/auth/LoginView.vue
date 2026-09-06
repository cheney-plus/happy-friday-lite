<template>
  <main class="login-page">
    <section class="login-panel">
      <img :src="logo" alt="Happy Friday" class="login-logo">
      <div class="login-heading"><h1>登录企业空间</h1><p>使用企业账号继续访问你的工作数据。</p></div>
      <form @submit.prevent="submit">
        <label>服务地址<input v-model.trim="serverURL" type="url" placeholder="http://127.0.0.1:8080" required></label>
        <label>邮箱<input v-model.trim="email" type="email" autocomplete="email" required></label>
        <label>密码<input v-model="password" type="password" autocomplete="current-password" required></label>
        <p v-if="error" class="login-error">{{ error }}</p>
        <button type="submit" :disabled="loading">{{ loading ? '正在登录...' : '登录' }}</button>
      </form>
    </section>
  </main>
</template>
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store'
import { getServerURL } from '@/services/enterprise'
const router = useRouter(); const auth = useAuthStore(); const serverURL = ref(getServerURL()); const email = ref(''); const password = ref(''); const error = ref(''); const loading = ref(false)
const logo = new URL('@/assets/images/friday-w.png', import.meta.url).href
async function submit() { loading.value = true; error.value = ''; try { await auth.signIn({ serverURL: serverURL.value, email: email.value, password: password.value }); router.replace('/friday') } catch (e) { error.value = e?.message || '登录失败，请检查服务地址和账号信息。' } finally { loading.value = false } }
</script>
<style scoped>
.login-page{min-height:100vh;display:grid;place-items:center;background:#edf2f7;padding:24px}.login-panel{width:min(420px,100%);background:#fff;border:1px solid #d9e0e8;padding:38px;border-radius:8px;box-shadow:0 12px 32px #22304d18}.login-logo{width:58px;height:58px;object-fit:contain;background:#192335;border-radius:8px;padding:7px}.login-heading h1{font-size:24px;margin:22px 0 8px}.login-heading p{color:#657080;margin:0 0 26px}form{display:grid;gap:16px}label{display:grid;gap:7px;color:#344054;font-weight:600}input{height:40px;padding:0 10px;border:1px solid #b9c4d0;border-radius:4px;font:inherit;color:#172033}button{height:42px;background:#0b63ce;border:0;border-radius:4px;color:#fff;font:600 15px inherit;cursor:pointer}button:disabled{opacity:.65}.login-error{margin:0;color:#b42318;font-size:13px}
</style>
