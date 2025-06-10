
"use client";

import { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Save } from 'lucide-react';

const profileSchema = z.object({
  name: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  email: z.string().email({ message: "Por favor, insira um email válido." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, updateUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      email: '',
    }
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
      });
    }
  }, [user, reset]);

  const onSubmit: SubmitHandler<ProfileFormValues> = async (data) => {
    if (!user) return;
    try {
      await updateUser({ name: data.name, email: data.email });
      toast({
        title: "Perfil Atualizado!",
        description: "Suas informações foram salvas com sucesso.",
        variant: "default",
        className: "bg-accent text-accent-foreground",
      });
    } catch (error) {
      toast({
        title: "Erro ao Atualizar",
        description: "Não foi possível salvar suas informações. Tente novamente.",
        variant: "destructive",
      });
    }
  };
  
  const getInitials = (name?: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0,2);
  }

  if (authLoading || (!user && authLoading)) { // Check authLoading first
    return (
       <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!user) { // If auth done and no user (should be caught by auth context for protected routes)
      return (
           <PageWrapper>
            <div className="container mx-auto px-4 py-8 text-center">
              <PageHeader title="Acesso Negado" description="Você precisa estar logado para acessar esta página."/>
            </div>
          </PageWrapper>
      )
  }


  return (
    <PageWrapper>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <PageHeader title="Meu Perfil" description="Gerencie suas informações pessoais." />
        
        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader className="items-center text-center border-b pb-6">
            <Avatar className="h-24 w-24 mb-4 ring-2 ring-primary ring-offset-background ring-offset-2">
              <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="user avatar large" />
              <AvatarFallback className="text-3xl font-semibold">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl">{user.name}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-semibold">Nome Completo</Label>
                <Input 
                  id="name" 
                  {...register('name')} 
                  placeholder="Seu nome completo"
                  className="text-base h-11 rounded-md shadow-sm"
                />
                {errors.name && <p className="text-sm text-destructive pt-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  {...register('email')} 
                  placeholder="seu@email.com"
                  className="text-base h-11 rounded-md shadow-sm"
                />
                {errors.email && <p className="text-sm text-destructive pt-1">{errors.email.message}</p>}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={isSubmitting || authLoading} className="w-full sm:w-auto min-w-[150px] h-11 text-base">
                {isSubmitting || authLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </PageWrapper>
  );
}
