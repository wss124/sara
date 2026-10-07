import { useState } from 'react';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Button, Input, message } from 'antd';
import { registerRequest } from '../../services/authService';
import '../Login/Login.css';

// Mesmos domínios aceitos pelo backend; a API valida de novo no cadastro
const DOMINIOS = ['aluno.uespi.br', 'prp.uespi.br'];

function emailInstitucional(_, valor) {
  const dominio = (valor || '').trim().toLowerCase().split('@').pop();
  if (!valor || DOMINIOS.includes(dominio)) {
    return Promise.resolve();
  }
  return Promise.reject(new Error(`Use seu e-mail institucional (@${DOMINIOS.join(' ou @')}).`));
}

export default function Register() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async ({ nome, email, senha }) => {
    setLoading(true);
    try {
      await registerRequest(nome, email, senha);
      message.success('Conta criada! Agora é só entrar.');
      navigate('/login');
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
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
            <h1>Crie sua conta</h1>
            <p>
              Cadastro exclusivo para alunos e professores da UESPI. Use seu e-mail
              institucional; professores são habilitados pelo administrador.
            </p>
          </div>
        </div>

        <div className="login-form-side">
          <h2 className="login-form-title">Criar conta</h2>

          <Form
            name="register"
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            className="login-form"
          >
            <Form.Item
              name="nome"
              rules={[{ required: true, whitespace: true, message: 'Informe seu nome.' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Nome completo" size="large" />
            </Form.Item>

            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Informe seu e-mail.' },
                { type: 'email', message: 'Informe um e-mail válido.' },
                { validator: emailInstitucional },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="seunome@aluno.uespi.br" size="large" />
            </Form.Item>

            <Form.Item
              name="senha"
              rules={[
                { required: true, message: 'Crie uma senha.' },
                { min: 6, message: 'A senha deve ter no mínimo 6 caracteres' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Senha" size="large" />
            </Form.Item>

            <Form.Item
              name="confirmacao"
              dependencies={['senha']}
              rules={[
                { required: true, message: 'Confirme a senha.' },
                ({ getFieldValue }) => ({
                  validator: (_, valor) =>
                    !valor || valor === getFieldValue('senha')
                      ? Promise.resolve()
                      : Promise.reject(new Error('As senhas não conferem.')),
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Confirmar senha" size="large" />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              className="login-button"
            >
              Criar conta
            </Button>
          </Form>

          <p className="login-register">
            Já tem conta? <Link to="/login">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
