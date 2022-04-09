class DNCViewSet(CompanyAccessMixin, GenericViewSet):
    """
    DNC viewset that only has actions to upload, export, and poll data.
    """
    serializer_class = DNCSerializer
    permission_classes = (IsAuthenticated, AdminPlusPermission)
    model = InternalDNC

    @action(
        detail=False,
        methods=['post'],
        parser_classes=[FormParser, MultiPartParser, FileUploadParser],
    )
    def upload(self, request):
        """
        Handles upload of `one-column` (Phone) CSV file with phone numbers to add to DNC List.
        """
        user = request.user
        company = user.profile.company
        upload_id = []

        results = verify_dnc_upload_files(request)

        for file in results["files"]:
            upload = UploadInternalDNC.objects.create(
                company=company,
                created_by=user,
                file=file["file"],
                uploaded_filename=str(file["file"]),
                has_column_header=file["has_header"],
            )
            upload_internal_dnc_task.delay(upload.id)
            upload_id.append(upload.id)

        data = {
            'id': upload_id,
            'has_error': results["has_error"],
            'detail': results["error_message"],
        }
        return Response(data)

    @swagger_auto_schema(responses={200: DNCBulkRemoveSerializer()})
    @action(
        detail=False,
        methods=['post'],
        parser_classes=[FormParser, MultiPartParser, FileUploadParser],
    )
    def bulk_remove(self, request):
        """
        Handles upload of a one column csv file with phone numbers to remove from DNC list.
        """
        user = request.user
        results = verify_dnc_upload_files(request)

        if not results["has_error"]:
            for file in results["files"]:
                bulk_remove_internal_dnc_task(file["file"], user)

        serializer = DNCBulkRemoveSerializer({
            'has_error': results["has_error"],
            'detail': results["error_message"],
        })
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def poll(self, request, pk=None):
        """
        Polls the DNC upload to get percent complete.
        """
        upload = UploadInternalDNC.objects.get(pk=pk)
        return Response({'percentage': upload.percentage, 'status': upload.status})

    @swagger_auto_schema(responses={200: DNCExportSerializer})
    @action(detail=False, methods=['get'], pagination_class=None)
    def export(self, request):
        """
        Exports the DNC numbers from both InternalDNC and Prospect models.  Provided `uuid` can
        be used to poll for readiness. Clears out DNC list, if has 'clear_dnc' in params.
        """
        company = request.user.profile.company
        filename = f'{company.name}_dnc_{timezone.now().date()}.csv'
        clear_dnc = request.query_params.get('clear_dnc') == 'true'

        filters = {
            'filename': filename,
        }

        download = DownloadHistory.objects.create(
            created_by=request.user,
            company=company,
            download_type=DownloadHistory.DownloadTypes.DNC,
            filters=filters,
            status=DownloadHistory.Status.SENT_TO_TASK,
        )

        message = ''
        if clear_dnc:
            removed, updated = company.dnc_list_count
            message = f"You are moving {removed} prospects from your DNC list, " \
                      f"and {updated} prospects are being removed from DNC."

            generate_download.delay(download.uuid, 'clear_dnc_list')
        else:
            generate_download.delay(download.uuid)

        serializer = DNCExportSerializer({'id': download.uuid, 'message': message})
        return Response(serializer.data)
