// Valida o formulário do Ant Design e devolve os valores, ou null quando há
// erros. O próprio formulário já mostra as mensagens nos campos; sem isso a
// rejeição do validateFields escaparia como "Uncaught (in promise)".
export async function validarFormulario(form) {
  try {
    return await form.validateFields();
  } catch {
    return null;
  }
}
