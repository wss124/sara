import { useState } from "react";
import { Form, Button, Input, Card, Typography, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import './Login.css'

const {Title, Text } = Typography;

export default function Login(){
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onFinish = async (values) => {

        setLoading(true);
        try{
            console.log('Login attempt:', values);

            setTimeout(() => {
                setLoading(false);
                message.success('Login realizado com sucesso!');

            }, 1000);
        } catch (error){
            setLoading(false);
            message.error('E-mail ou senha inválidos!');
        }
    };


    return(
        <div>
            <Card className="Login-card">
                <div className="login-header">
                    <Title level= {2} className="login-title">SARA</Title>
                   <Text type="secondary">Sistema de Alocação de Recursos Acadêmicos</Text>
                </div> 
                
                <Form
                  name="login"
                  layout="vertical" 
                  onFinish={onFinish}
                  autoComplete="off"
                  className="login-form"
                >
                  <Form.Item
                  label="E-mail"
                  name="email"
                  rules={[
                    {required: true , message: 'Informe seu e-mail.'},
                    {type: 'email', message: 'Informe um e-mail válido.'}

                  ]}

                  >
                    <Input
                    prefix={<UserOutlined/>}
                    placeholder="seuemail@uespi.br"
                    size="large"
                    />
                    </Form.Item> 

                    <Form.Item
                    label="Senha"
                  name="senha"
                  rules={[
                    {required: true , message: 'Informe sua senha.'},
                    {type: 'email', message: 'A senha deve ter no mínimo 6 caracteres'}

                  ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Sua senha"
                            size="large"
                        />
                        
                        </Form.Item> 
                        <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        block
                        size="large"
                        className="login-button"
                        >Entrar</Button>
                </Form>

            </Card>
        </div>
    )
}