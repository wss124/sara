import { useState } from "react";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { loginRequest } from '../../services/authService';
import './Login.css'
import { Form, Button, Input, Checkbox, message } from "antd";




export default function Login(){
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onFinish = async (values) => {

        setLoading(true);
        try{
            const data = await loginRequest(values.email, values.senha);

    localStorage.setItem('sara_auth', 'true');
    localStorage.setItem('sara_token', data.token);
    localStorage.setItem('sara_user', JSON.stringify(data.usuario));
    setLoading(false);
    message.success('Login realizado com sucesso!');
    navigate('/home');
        } catch (error){
            setLoading(false);
        const msg = error.response?.data?.error || 'Erro ao fazer login.';
     message.error(msg);
        }
    };


     return (
   <div className="login-container">
     <div className="login-box">
       <div className="login-side">
         <span className="login-brand">SARA</span>
         <span className="deco deco-circle deco-circle-1" />
         <span className="deco deco-circle deco-circle-2" />
         <span className="deco deco-plus deco-plus-1">+</span>
         <span className="deco deco-plus deco-plus-2">+</span>
         <span className="deco deco-dots" />
         <span className="deco deco-rings" />

         <div className="login-side-content">
           <h1>Bem-vindo de volta!</h1>
           <p>Acesse o Sistema de Alocação de Recursos Acadêmicos com a sua conta.</p>
         </div>
       </div>

       <div className="login-form-side">
         <h2 className="login-form-title">Entrar</h2>

         <Form
           name="login"
           layout="vertical"
           onFinish={onFinish}
           autoComplete="off"
           className="login-form"
         >
           <Form.Item
             name="email"
             rules={[
               { required: true, message: 'Informe seu e-mail.' },
               { type: 'email', message: 'Informe um e-mail válido.' },
             ]}
           >
             <Input prefix={<UserOutlined />} placeholder="seuemail@uespi.br" size="large" />
           </Form.Item>

           <Form.Item
             name="senha"
             rules={[
               { required: true, message: 'Informe sua senha.' },
               { min: 6, message: 'A senha deve ter no mínimo 6 caracteres' },
             ]}
           >
             <Input.Password prefix={<LockOutlined />} placeholder="Senha" size="large" />
           </Form.Item>

           <div className="login-options">
             <Form.Item name="remember" valuePropName="checked" noStyle>
               <Checkbox>Lembrar de mim</Checkbox>
             </Form.Item>
             <a href="#" className="login-link" onClick={(e) => e.preventDefault()}>
               Esqueci a senha
             </a>
           </div>

           <Button
             type="primary"
             htmlType="submit"
             loading={loading}
             block
             size="large"
             className="login-button"
           >
             Entrar
           </Button>
         </Form>

         <p className="login-register">
           Novo por aqui?{' '}
           <a href="#" onClick={(e) => e.preventDefault()}>Criar conta</a>
         </p>
       </div>
     </div>
   </div>
 )
}