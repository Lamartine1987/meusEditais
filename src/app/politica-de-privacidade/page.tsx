
"use client";

import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function PoliticaDePrivacidadePage() {
  return (
    <PageWrapper>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <PageHeader 
          title="Política de Privacidade"
          description="Última atualização: 29 de Julho de 2024"
        />

        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-xl text-center">
              Sua privacidade é importante para nós.
            </CardTitle>
          </CardHeader>
          <CardContent>
             <ScrollArea className="h-[60vh] p-4 border rounded-md">
                <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
                    <p>
                       A sua privacidade é de extrema importância para a plataforma Meus Editais. Esta política de privacidade descreve os tipos de informações pessoais que coletamos e como as usamos, armazenamos e protegemos, em conformidade com a Lei Geral de Proteção de Dados (LGPD).
                    </p>

                    <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">1. Informações que Coletamos</h2>
                        <p>Coletamos diferentes tipos de informações para fornecer e melhorar nosso serviço para você:</p>
                        <ul className="list-disc pl-6 space-y-1">
                            <li><strong>Informações de Cadastro:</strong> Quando você cria uma conta, coletamos seu nome, endereço de e-mail e senha.</li>
                            <li><strong>Dados de Pagamento:</strong> Para assinaturas de planos pagos, nosso processador de pagamentos (Stripe) coleta as informações necessárias para a transação. Não armazenamos os dados do seu cartão de crédito em nossos servidores.</li>
                            <li><strong>Dados de Uso e Progresso:</strong> Coletamos as informações que você gera ao usar a plataforma, como cargos em que se inscreve, tópicos marcados como estudados, logs de tempo de estudo, registros de desempenho em questões, agendamentos de revisão e anotações pessoais.</li>
                            <li><strong>Preferências:</strong> Armazenamos suas preferências, como a sua decisão de participar ou não do ranking de estudos.</li>
                        </ul>
                    </section>
                    
                    <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">2. Como Usamos Suas Informações</h2>
                        <p>Utilizamos as informações coletadas para os seguintes propósitos:</p>
                         <ul className="list-disc pl-6 space-y-1">
                            <li>Para fornecer e manter nosso serviço, incluindo o gerenciamento de sua conta e acesso aos planos.</li>
                            <li>Para personalizar sua experiência, exibindo seu progresso e estatísticas de estudo.</li>
                            <li>Para processar suas transações de pagamento.</li>
                            <li>Para exibir seu nome e progresso no Ranking de Estudos, caso você opte por participar. Sua participação é opcional e pode ser alterada a qualquer momento em seu perfil.</li>
                            <li>Para nos comunicarmos com você sobre sua conta ou atualizações em nossos serviços.</li>
                            <li>Para monitorar o uso de nosso serviço e coletar dados analíticos para melhorá-lo.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">3. Compartilhamento e Armazenamento de Dados</h2>
                        <p>3.1. Não vendemos, alugamos ou trocamos suas informações pessoais com terceiros para fins de marketing.</p>
                        <p>3.2. Seus dados são armazenados de forma segura em servidores do Firebase (Google Cloud Platform). Utilizamos medidas de segurança técnicas e administrativas para proteger suas informações contra acesso não autorizado, perda ou destruição.</p>
                        <p>3.3. Suas informações de pagamento são gerenciadas diretamente pelo Stripe, que possui certificação PCI Nível 1, o mais alto nível de segurança do setor de pagamentos.</p>
                    </section>

                     <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">4. Seus Direitos</h2>
                        <p>De acordo com a LGPD, você tem o direito de:</p>
                        <ul className="list-disc pl-6 space-y-1">
                           <li>Acessar seus dados pessoais.</li>
                           <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
                           <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.</li>
                           <li>Solicitar a portabilidade dos seus dados a outro fornecedor de serviço.</li>
                           <li>Revogar o consentimento a qualquer momento (por exemplo, alterando sua participação no ranking).</li>
                        </ul>
                        <p>Você pode gerenciar a maioria de seus dados diretamente na sua página de Perfil. Para outras solicitações, entre em contato conosco.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">5. Cookies</h2>
                        <p>Usamos cookies essenciais para o funcionamento da plataforma, como manter sua sessão de login ativa. Não utilizamos cookies para rastreamento de marketing de terceiros.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-lg font-semibold text-primary">6. Contato</h2>
                        <p>Se você tiver alguma dúvida sobre esta Política de Privacidade, entre em contato conosco através de contato@meuseditais.com.br.</p>
                    </section>
                </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
