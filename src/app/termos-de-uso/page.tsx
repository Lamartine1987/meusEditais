
"use client";

import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function TermosDeUsoPage() {
  return (
    <PageWrapper>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <PageHeader 
          title="Termos e Condições de Uso"
          description="Última atualização: 29 de Julho de 2024"
        />

        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-xl text-center">
              Bem-vindo(a) à Plataforma Meus Editais!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh] p-4 border rounded-md">
                <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
                    <p>
                        Estes termos e condições descrevem as regras e regulamentos para o uso da plataforma Meus Editais, localizada em [URL do seu site]. Ao acessar esta plataforma, presumimos que você aceita estes termos e condições. Não continue a usar o Meus Editais se não concordar com todos os termos e condições declarados nesta página.
                    </p>

                    <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">1. Contas de Usuário</h2>
                        <p>1.1. Para acessar a maioria das funcionalidades da plataforma, você deve se registrar para uma conta. Você deve fornecer informações precisas e completas durante o registro e manter as informações da sua conta atualizadas.</p>
                        <p>1.2. Você é responsável por proteger a sua senha e por todas as atividades que ocorram sob sua conta. Você concorda em nos notificar imediatamente sobre qualquer uso não autorizado de sua conta.</p>
                    </section>
                    
                    <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">2. Planos, Pagamentos e Cancelamentos</h2>
                        <p>2.1. A plataforma oferece planos de acesso gratuitos (Teste) e pagos (Plano Cargo, Plano Edital, Plano Anual). Cada plano concede diferentes níveis de acesso ao conteúdo, conforme descrito na página "Nossos Planos".</p>
                        <p>2.2. Os pagamentos para planos pagos são processados através de nosso parceiro de pagamentos, Stripe. Ao fornecer informações de pagamento, você declara que tem o direito legal de usar o método de pagamento selecionado.</p>
                        <p>2.3. Os planos pagos são baseados em pagamento único com validade de 1 (um) ano. Não há cobranças recorrentes automáticas.</p>
                        <p>2.4. <strong>Cancelamento e Reembolso:</strong> O usuário tem o direito de solicitar o cancelamento e o reembolso de um plano pago no prazo de até 7 (sete) dias corridos a partir da data da compra, conforme previsto pelo Código de Defesa do Consumidor. A solicitação deve ser feita diretamente através da página de Perfil.</p>
                        <p>2.5. Após o prazo de 7 dias, não será mais possível solicitar o cancelamento ou o reembolso do plano, uma vez que se trata de um produto digital de acesso imediato.</p>
                        <p>2.6. Uma vez que o reembolso seja aprovado e processado por nossa equipe (dentro do prazo de 7 dias), a transação de estorno será iniciada junto à nossa processadora de pagamentos (Stripe). Você receberá um e-mail de confirmação da Stripe assim que o estorno for realizado. Por favor, esteja ciente de que, após nossa confirmação, o tempo para que o valor seja creditado em sua fatura ou conta depende exclusivamente dos prazos da sua operadora de cartão de crédito, podendo levar alguns dias úteis.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">3. Uso da Plataforma</h2>
                        <p>3.1. Você concorda em usar a plataforma apenas para fins legais e de acordo com estes Termos. Você concorda em não usar a plataforma de forma que possa desativar, sobrecarregar ou danificar o serviço.</p>
                        <p>3.2. O conteúdo fornecido, incluindo a estrutura de editais, cargos e matérias, é de propriedade do Meus Editais. Você não pode copiar, modificar, distribuir ou criar trabalhos derivados baseados em nosso conteúdo sem permissão expressa.</p>
                        <p>3.3. Os dados que você insere (progresso de estudo, notas, desempenho em questões) são de sua propriedade, mas você nos concede uma licença para usar esses dados de forma anônima e agregada para melhorar nossos serviços e, caso opte, para exibi-los no Ranking de Estudos.</p>
                    </section>

                     <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">4. Limitação de Responsabilidade</h2>
                        <p>4.1. A plataforma Meus Editais é fornecida "como está". Embora nos esforcemos para fornecer informações precisas e atualizadas, não garantimos que as informações sobre os editais estejam sempre completas ou livres de erros. É responsabilidade do usuário confirmar as informações nos documentos oficiais do concurso.</p>
                        <p>4.2. Em nenhuma circunstância o Meus Editais será responsável por quaisquer danos diretos, indiretos, incidentais ou consequentes resultantes do uso ou da incapacidade de usar nosso serviço.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">5. Alterações nos Termos</h2>
                        <p>Reservamo-nos o direito de modificar estes termos a qualquer momento. Notificaremos os usuários sobre quaisquer alterações significativas. O uso continuado da plataforma após tais alterações constitui sua aceitação dos novos termos.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">6. Contato</h2>
                        <p>Se você tiver alguma dúvida sobre estes Termos, entre em contato conosco através de contato@meuseditais.com.br.</p>
                    </section>
                </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
